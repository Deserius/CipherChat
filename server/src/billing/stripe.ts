import Stripe from 'stripe';
import { PRICE_CATALOG, type PlanId, type PriceKey } from '../../../shared/billing.ts';
import { config } from '../config.ts';
import { issueEntitlement, type Entitlement } from './entitlement.ts';

let stripe: Stripe | null = null;
const priceCache = new Map<PriceKey, string>();

export function stripeEnabled(): boolean {
  return Boolean(config.stripeSecretKey);
}

export function getStripe(): Stripe | null {
  if (!config.stripeSecretKey) return null;
  if (!stripe) {
    stripe = new Stripe(config.stripeSecretKey);
  }
  return stripe;
}

function envPrice(key: PriceKey): string {
  switch (key) {
    case 'plus_monthly':
      return config.stripePricePlusMonthly;
    case 'plus_yearly':
      return config.stripePricePlusYearly;
    case 'pro_monthly':
      return config.stripePriceProMonthly;
    case 'pro_yearly':
      return config.stripePriceProYearly;
  }
}

export async function resolvePriceId(key: PriceKey): Promise<string> {
  const fromEnv = envPrice(key);
  if (fromEnv) return fromEnv;
  const cached = priceCache.get(key);
  if (cached) return cached;
  const client = getStripe();
  if (!client) throw new Error('stripe-disabled');

  const lookup = `cipherchat_${key}`;
  const existing = await client.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  if (existing.data[0]?.id) {
    priceCache.set(key, existing.data[0].id);
    return existing.data[0].id;
  }

  const spec = PRICE_CATALOG[key];
  const product = await client.products.create({
    name: spec.plan === 'plus' ? 'CipherChat Plus' : 'CipherChat Pro',
    description:
      spec.plan === 'plus'
        ? 'HD video, larger rooms, bigger files, 24-hour room hold.'
        : 'Highest limits: 40 people, 80 MB files, 7-day room hold.',
    metadata: { cipherchat: spec.plan },
  });
  const price = await client.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: spec.amountUsd * 100,
    recurring: { interval: spec.interval },
    lookup_key: lookup,
    metadata: { cipherchat_price: key, cipherchat_plan: spec.plan },
  });
  priceCache.set(key, price.id);
  return price.id;
}

export async function listPublicPrices(): Promise<
  { key: PriceKey; plan: PlanId; interval: 'month' | 'year'; amountUsd: number; label: string; configured: boolean }[]
> {
  const enabled = stripeEnabled();
  const rows: {
    key: PriceKey;
    plan: PlanId;
    interval: 'month' | 'year';
    amountUsd: number;
    label: string;
    configured: boolean;
  }[] = [];
  for (const key of Object.keys(PRICE_CATALOG) as PriceKey[]) {
    const spec = PRICE_CATALOG[key];
    rows.push({
      key,
      plan: spec.plan,
      interval: spec.interval,
      amountUsd: spec.amountUsd,
      label: spec.label,
      configured: enabled,
    });
  }
  return rows;
}

export async function createCheckoutSession(opts: {
  priceKey: PriceKey;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
}): Promise<{ url: string; id: string }> {
  const client = getStripe();
  if (!client) throw new Error('stripe-disabled');
  const spec = PRICE_CATALOG[opts.priceKey];
  if (!spec) throw new Error('invalid-price');
  const price = await resolvePriceId(opts.priceKey);
  const session = await client.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    customer: opts.customerId || undefined,
    metadata: {
      cipherchat_plan: spec.plan,
      cipherchat_price: opts.priceKey,
    },
    subscription_data: {
      metadata: {
        cipherchat_plan: spec.plan,
        cipherchat_price: opts.priceKey,
      },
    },
  });
  if (!session.url) throw new Error('stripe-session');
  return { url: session.url, id: session.id };
}

export async function createPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const client = getStripe();
  if (!client) throw new Error('stripe-disabled');
  const portal = await client.billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: opts.returnUrl,
  });
  return { url: portal.url };
}

function planFromMeta(meta: Stripe.Metadata | null | undefined): Exclude<PlanId, 'free'> | null {
  const p = meta?.cipherchat_plan;
  if (p === 'plus' || p === 'pro') return p;
  return null;
}

export async function entitlementFromCheckout(sessionId: string): Promise<{
  token: string;
  entitlement: Entitlement;
} | null> {
  const client = getStripe();
  if (!client) return null;
  const session = await client.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });
  if (session.payment_status !== 'paid' && session.status !== 'complete') return null;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!customerId) return null;
  let plan = planFromMeta(session.metadata);
  let expires = Date.now() + 32 * 24 * 60 * 60 * 1000;
  const sub = session.subscription;
  if (sub && typeof sub !== 'string') {
    plan = planFromMeta(sub.metadata) ?? plan;
    if (sub.status !== 'active' && sub.status !== 'trialing') return null;
    const period = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
    if (typeof period === 'number') expires = period * 1000;
  }
  if (!plan) return null;
  const token = issueEntitlement({ plan, customerId, expiresAt: expires });
  return {
    token,
    entitlement: {
      v: 1,
      plan,
      sub: customerId,
      exp: Math.floor(expires / 1000),
      iat: Math.floor(Date.now() / 1000),
    },
  };
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.paid':
    case 'invoice.payment_failed':
      // Entitlements are issued at claim time from live Stripe state.
      // Subscription cancellations take effect when the signed token expires
      // or the next claim/status check hits Stripe.
      break;
    default:
      break;
  }
}

export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const client = getStripe();
  if (!client) throw new Error('stripe-disabled');
  if (!config.stripeWebhookSecret) throw new Error('webhook-unconfigured');
  return client.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}
