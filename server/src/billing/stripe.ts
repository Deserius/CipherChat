import Stripe from 'stripe';
import { PARTY_ADDON_USD, PARTY_PACKS, PRICE_CATALOG, type PlanId, type PriceKey } from '../../../shared/billing.ts';
import { config } from '../config.ts';
import { issueEntitlement, type Entitlement } from './entitlement.ts';
import { findByStripeSession, issuePurchase } from './passes.ts';

let stripe: Stripe | null = null;
const priceCache = new Map<string, string>();

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
    default:
      return '';
  }
}

export async function resolvePriceId(key: Extract<PriceKey, 'plus_monthly' | 'plus_yearly' | 'pro_monthly' | 'pro_yearly'>): Promise<string> {
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

export function describeProduct(priceKey: PriceKey, extraSeats = 0): {
  plan: Exclude<PlanId, 'free'>;
  kind: 'sub' | 'party';
  seats: number;
  durationMs: number;
  amountUsd: number;
  label: string;
} {
  if (priceKey === 'party_addon') {
    const n = Math.max(1, extraSeats);
    return {
      plan: 'party',
      kind: 'party',
      seats: n,
      durationMs: 0,
      amountUsd: n * PARTY_ADDON_USD,
      label: `${n} extra invite${n === 1 ? '' : 's'}`,
    };
  }
  const pack = PARTY_PACKS.find((p) => p.key === priceKey);
  if (pack) {
    return {
      plan: 'party',
      kind: 'party',
      seats: pack.seats,
      durationMs: pack.hours * 60 * 60 * 1000,
      amountUsd: pack.amountUsd,
      label: `${pack.name} · ${pack.seats} guests · ${pack.hours}h`,
    };
  }
  const spec = PRICE_CATALOG[priceKey as keyof typeof PRICE_CATALOG];
  if (!spec) throw new Error('invalid-price');
  const durationMs = spec.interval === 'year' ? 365 * 24 * 60 * 60 * 1000 : 32 * 24 * 60 * 60 * 1000;
  return {
    plan: spec.plan,
    kind: 'sub',
    seats: spec.plan === 'pro' ? 40 : 20,
    durationMs,
    amountUsd: spec.amountUsd,
    label: spec.label,
  };
}

export async function listPublicPrices() {
  const enabled = stripeEnabled() || config.billingSandbox;
  const subs = (Object.keys(PRICE_CATALOG) as (keyof typeof PRICE_CATALOG)[]).map((key) => {
    const spec = PRICE_CATALOG[key];
    return {
      key,
      plan: spec.plan,
      interval: spec.interval,
      amountUsd: spec.amountUsd,
      label: spec.label,
      configured: enabled,
    };
  });
  return {
    enabled,
    sandbox: config.billingSandbox && !stripeEnabled(),
    stripe: stripeEnabled(),
    testMode: stripeEnabled() ? config.stripeSecretKey.startsWith('sk_test_') : config.billingSandbox,
    subscriptions: subs,
    party: PARTY_PACKS.map((p) => ({ ...p, configured: enabled })),
    addonUsd: PARTY_ADDON_USD,
  };
}

export async function createCheckoutSession(opts: {
  priceKey: PriceKey;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  extraSeats?: number;
  attachPassId?: string;
}): Promise<{ url: string; id: string }> {
  const client = getStripe();
  if (!client) throw new Error('stripe-disabled');
  const product = describeProduct(opts.priceKey, opts.extraSeats);
  const metadata: Record<string, string> = {
    cipherchat_plan: product.plan,
    cipherchat_price: opts.priceKey,
    cipherchat_kind: product.kind,
    cipherchat_seats: String(product.seats),
    cipherchat_duration: String(product.durationMs),
  };
  if (opts.attachPassId) metadata.cipherchat_pass = opts.attachPassId;

  if (product.kind === 'party') {
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(product.amountUsd * 100),
            product_data: { name: `CipherChat ${product.label}` },
          },
        },
      ],
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata,
      payment_intent_data: { metadata },
    });
    if (!session.url) throw new Error('stripe-session');
    return { url: session.url, id: session.id };
  }

  const price = await resolvePriceId(opts.priceKey as 'plus_monthly' | 'plus_yearly' | 'pro_monthly' | 'pro_yearly');
  const session = await client.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    customer: opts.customerId || undefined,
    metadata,
    subscription_data: { metadata },
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

export async function refundStripe(paymentIntentId: string, amountCents: number): Promise<string | null> {
  const client = getStripe();
  if (!client) return null;
  const refund = await client.refunds.create({
    payment_intent: paymentIntentId,
    amount: amountCents,
  });
  return refund.id;
}

function planFromMeta(meta: Stripe.Metadata | null | undefined): Exclude<PlanId, 'free'> | null {
  const p = meta?.cipherchat_plan;
  if (p === 'plus' || p === 'pro' || p === 'party') return p;
  return null;
}

export async function entitlementFromCheckout(sessionId: string): Promise<{
  token: string;
  entitlement: Entitlement;
  passCode?: string;
  passId: string;
} | null> {
  const client = getStripe();
  if (!client) return null;
  const session = await client.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'payment_intent'],
  });
  if (session.payment_status !== 'paid' && session.status !== 'complete') return null;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? `anon_${session.id}`;
  const meta = session.metadata ?? {};
  let plan = planFromMeta(meta);
  let expires = Date.now() + 32 * 24 * 60 * 60 * 1000;
  const sub = session.subscription;
  if (sub && typeof sub !== 'string') {
    plan = planFromMeta(sub.metadata) ?? plan;
    if (sub.status !== 'active' && sub.status !== 'trialing') return null;
    const period = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
    if (typeof period === 'number') expires = period * 1000;
  }
  if (!plan) return null;
  const kind = meta.cipherchat_kind === 'party' || plan === 'party' ? 'party' : 'sub';
  const seats = Number(meta.cipherchat_seats || 0) || (plan === 'pro' ? 40 : 20);
  const durationMs = Number(meta.cipherchat_duration || 0) || (kind === 'party' ? 6 * 3600_000 : expires - Date.now());
  const pi =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  const existing = findByStripeSession(session.id);
  const issued = issuePurchase({
    plan,
    kind,
    seats: meta.cipherchat_price === 'party_addon' ? Number(meta.cipherchat_seats || 1) : seats,
    durationMs: durationMs || 32 * 24 * 3600_000,
    amountPaidCents: session.amount_total ?? 0,
    stripeSessionId: session.id,
    stripePaymentIntentId: pi,
    attachPassId: meta.cipherchat_pass,
    extraSeats: meta.cipherchat_price === 'party_addon' ? seats : undefined,
  });
  const token = issueEntitlement({
    plan: issued.pass.plan,
    customerId,
    expiresAt: issued.pass.expiresAt,
    kind: issued.pass.kind,
    seats: issued.pass.seats,
    durationMs: issued.pass.durationMs,
    passId: issued.pass.id,
  });
  return {
    token,
    passCode: existing ? undefined : issued.code,
    passId: issued.pass.id,
    entitlement: {
      v: 1,
      plan: issued.pass.plan,
      sub: customerId,
      exp: Math.floor(issued.pass.expiresAt / 1000),
      iat: Math.floor(Date.now() / 1000),
      kind: issued.pass.kind,
      seats: issued.pass.seats,
      durationMs: issued.pass.durationMs,
      passId: issued.pass.id,
    },
  };
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.id) await entitlementFromCheckout(session.id).catch(() => undefined);
  }
}

export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const client = getStripe();
  if (!client) throw new Error('stripe-disabled');
  if (!config.stripeWebhookSecret) throw new Error('webhook-unconfigured');
  return client.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}
