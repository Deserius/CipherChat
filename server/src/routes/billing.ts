import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { PRICE_CATALOG, PLAN_LIMITS, type PriceKey } from '../../../shared/billing.ts';
import { config } from '../config.ts';
import { verifyEntitlement } from '../billing/entitlement.ts';
import {
  constructWebhookEvent,
  createCheckoutSession,
  createPortalSession,
  entitlementFromCheckout,
  handleStripeEvent,
  listPublicPrices,
  stripeEnabled,
} from '../billing/stripe.ts';

function appOrigin(req: Request): string {
  const configured = config.appUrl.replace(/\/$/, '');
  const xfProto = req.headers['x-forwarded-proto'];
  const proto = typeof xfProto === 'string' && xfProto ? xfProto.split(',')[0]!.trim() : req.protocol;
  const host = req.headers.host;
  if (config.trustProxy && host) return `${proto}://${host}`;
  return configured;
}

export function createBillingRouter() {
  const api = Router();

  api.get('/plans', async (_req, res) => {
    const prices = await listPublicPrices();
    res.json({
      enabled: stripeEnabled(),
      processor: 'stripe',
      plans: PLAN_LIMITS,
      prices,
    });
  });

  api.get('/status', (req, res) => {
    const header = req.headers['x-cipher-entitlement'];
    const token = typeof header === 'string' ? header : undefined;
    const ent = verifyEntitlement(token);
    if (!ent) {
      res.json({ plan: 'free', limits: PLAN_LIMITS.free, active: false });
      return;
    }
    res.json({
      plan: ent.plan,
      limits: PLAN_LIMITS[ent.plan],
      active: true,
      expiresAt: ent.exp * 1000,
    });
  });

  api.post('/checkout', async (req, res) => {
    if (!stripeEnabled()) {
      res.status(503).json({
        error: 'Stripe is not configured on this server.',
        hint: 'Set STRIPE_SECRET_KEY (and optionally STRIPE_PRICE_* / STRIPE_WEBHOOK_SECRET) then restart.',
      });
      return;
    }
    const schema = z.object({
      priceKey: z.enum(['plus_monthly', 'plus_yearly', 'pro_monthly', 'pro_yearly']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Choose a Plus or Pro plan.' });
      return;
    }
    const origin = appOrigin(req);
    try {
      const session = await createCheckoutSession({
        priceKey: parsed.data.priceKey as PriceKey,
        successUrl: `${origin}/plus/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/plus?canceled=1`,
      });
      res.json({ url: session.url, id: session.id });
    } catch (err) {
      console.warn('stripe checkout failed', err);
      res.status(502).json({ error: 'Unable to start Stripe Checkout.' });
    }
  });

  api.post('/claim', async (req, res) => {
    if (!stripeEnabled()) {
      res.status(503).json({ error: 'Stripe is not configured on this server.' });
      return;
    }
    const schema = z.object({ sessionId: z.string().min(8).max(256) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing Checkout session.' });
      return;
    }
    try {
      const claimed = await entitlementFromCheckout(parsed.data.sessionId);
      if (!claimed) {
        res.status(402).json({ error: 'Payment is not complete yet.' });
        return;
      }
      res.json({
        token: claimed.token,
        plan: claimed.entitlement.plan,
        expiresAt: claimed.entitlement.exp * 1000,
        limits: PLAN_LIMITS[claimed.entitlement.plan],
      });
    } catch (err) {
      console.warn('stripe claim failed', err);
      res.status(502).json({ error: 'Unable to confirm payment with Stripe.' });
    }
  });

  api.post('/portal', async (req, res) => {
    if (!stripeEnabled()) {
      res.status(503).json({ error: 'Stripe is not configured on this server.' });
      return;
    }
    const header = req.headers['x-cipher-entitlement'];
    const token = typeof header === 'string' ? header : typeof req.body?.token === 'string' ? req.body.token : undefined;
    const ent = verifyEntitlement(token);
    if (!ent) {
      res.status(401).json({ error: 'No active CipherChat subscription on this device.' });
      return;
    }
    try {
      const origin = appOrigin(req);
      const portal = await createPortalSession({
        customerId: ent.sub,
        returnUrl: `${origin}/plus`,
      });
      res.json({ url: portal.url });
    } catch (err) {
      console.warn('stripe portal failed', err);
      res.status(502).json({ error: 'Unable to open the Stripe billing portal.' });
    }
  });

  return api;
}

export async function billingWebhook(req: Request, res: Response) {
  if (!stripeEnabled()) {
    res.status(503).json({ error: 'Stripe is not configured.' });
    return;
  }
  const sig = req.headers['stripe-signature'];
  if (typeof sig !== 'string') {
    res.status(400).json({ error: 'Missing Stripe signature.' });
    return;
  }
  try {
    const event = constructWebhookEvent(req.body as Buffer, sig);
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.warn('stripe webhook rejected', err);
    res.status(400).json({ error: 'Invalid Stripe webhook.' });
  }
}

export { PRICE_CATALOG };
