import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { PLAN_LIMITS, PARTY_PACKS, limitsForPlan, type PriceKey } from '../../../shared/billing.ts';
import { config } from '../config.ts';
import { issueEntitlement, verifyEntitlement } from '../billing/entitlement.ts';
import {
  constructWebhookEvent,
  createCheckoutSession,
  createPortalSession,
  describeProduct,
  entitlementFromCheckout,
  handleStripeEvent,
  listPublicPrices,
  refundStripe,
  stripeEnabled,
} from '../billing/stripe.ts';
import {
  createSandboxOrder,
  evaluateTestCard,
  getSandboxOrder,
  markSandboxPaid,
} from '../billing/sandbox.ts';
import {
  findByCode,
  findById,
  issuePurchase,
  noteJoin,
  refundableCents,
  unusedSeats,
  updatePass,
  type StoredPass,
} from '../billing/passes.ts';
import { hit } from '../security/rateLimit.ts';

const PRICE_KEYS = [
  'plus_monthly',
  'plus_yearly',
  'pro_monthly',
  'pro_yearly',
  'party_spark',
  'party_house',
  'party_night',
  'party_weekend',
  'party_addon',
] as const;

function appOrigin(req: Request): string {
  const configured = config.appUrl.replace(/\/$/, '');
  const xfProto = req.headers['x-forwarded-proto'];
  const proto = typeof xfProto === 'string' && xfProto ? xfProto.split(',')[0]!.trim() : req.protocol;
  const host = req.headers.host;
  if (config.trustProxy && host) return `${proto}://${host}`;
  return configured;
}

function tokenFor(pass: StoredPass) {
  return issueEntitlement({
    plan: pass.plan,
    customerId: pass.id,
    expiresAt: pass.expiresAt,
    kind: pass.kind,
    seats: pass.seats,
    durationMs: pass.durationMs,
    passId: pass.id,
  });
}

function passPublic(pass: StoredPass, code?: string) {
  return {
    token: tokenFor(pass),
    passCode: code,
    passId: pass.id,
    plan: pass.plan,
    kind: pass.kind,
    seats: pass.seats,
    unusedSeats: unusedSeats(pass),
    expiresAt: pass.expiresAt,
    roomCode: pass.roomCode,
    limits: limitsForPlan(pass.plan, { seats: pass.seats, durationMs: pass.durationMs }),
    refundableCents: refundableCents(pass),
  };
}

function billingReady() {
  return stripeEnabled() || config.billingSandbox;
}

export function createBillingRouter() {
  const api = Router();

  api.get('/plans', async (_req, res) => {
    const catalog = await listPublicPrices();
    res.json({
      ...catalog,
      processor: stripeEnabled() ? 'stripe' : 'stripe-sandbox',
      plans: PLAN_LIMITS,
      party: PARTY_PACKS,
      testCards: config.billingSandbox && !stripeEnabled()
        ? { success: '4242 4242 4242 4242', decline: '4000 0000 0000 0002' }
        : undefined,
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
    const pass = ent.passId ? findById(ent.passId) : undefined;
    res.json({
      plan: ent.plan,
      limits: limitsForPlan(ent.plan, ent.seats && ent.durationMs ? { seats: ent.seats, durationMs: ent.durationMs } : undefined),
      active: true,
      expiresAt: ent.exp * 1000,
      kind: ent.kind ?? 'sub',
      seats: pass?.seats ?? ent.seats,
      roomCode: pass?.roomCode,
      refundableCents: pass ? refundableCents(pass) : 0,
    });
  });

  api.post('/checkout', async (req, res) => {
    if (!billingReady()) {
      res.status(503).json({
        error: 'Billing is not configured.',
        hint: 'Set STRIPE_SECRET_KEY=sk_test_… or BILLING_SANDBOX=true',
      });
      return;
    }
    const schema = z.object({
      priceKey: z.enum(PRICE_KEYS),
      extraSeats: z.number().int().min(1).max(40).optional(),
      attachPassId: z.string().max(64).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Choose a plan or party pack.' });
      return;
    }
    const origin = appOrigin(req);
    const product = describeProduct(parsed.data.priceKey as PriceKey, parsed.data.extraSeats);
    if (stripeEnabled()) {
      try {
        const session = await createCheckoutSession({
          priceKey: parsed.data.priceKey as PriceKey,
          extraSeats: parsed.data.extraSeats,
          attachPassId: parsed.data.attachPassId,
          successUrl: `${origin}/plus/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/plus?canceled=1`,
        });
        res.json({ url: session.url, id: session.id, processor: 'stripe' });
      } catch (err) {
        console.warn('stripe checkout failed', err);
        res.status(502).json({ error: 'Unable to start Stripe Checkout.' });
      }
      return;
    }
    const order = createSandboxOrder({
      priceKey: parsed.data.priceKey,
      amountUsd: product.amountUsd,
      plan: product.plan,
      kind: product.kind,
      seats: product.seats,
      durationMs: product.durationMs || 6 * 3600_000,
      extraSeats: parsed.data.extraSeats,
      attachPassId: parsed.data.attachPassId,
    });
    res.json({
      url: `${origin}/pay/sandbox?order=${order.id}`,
      id: order.id,
      processor: 'stripe-sandbox',
      sandbox: true,
    });
  });

  api.get('/sandbox/order/:id', (req, res) => {
    if (stripeEnabled() || !config.billingSandbox) {
      res.status(404).json({ error: 'Sandbox checkout is off while Stripe keys are set.' });
      return;
    }
    const order = getSandboxOrder(req.params.id ?? '');
    if (!order) {
      res.status(404).json({ error: 'Order expired. Start checkout again.' });
      return;
    }
    res.json({
      id: order.id,
      label: describeProduct(order.priceKey as PriceKey, order.extraSeats).label,
      amountUsd: order.amountUsd,
      plan: order.plan,
      kind: order.kind,
      seats: order.seats,
      hours: Math.round(order.durationMs / 3600_000),
    });
  });

  api.post('/sandbox/pay', (req, res) => {
    if (stripeEnabled() || !config.billingSandbox) {
      res.status(409).json({ error: 'Sandbox is disabled. Use Stripe Checkout.' });
      return;
    }
    const limited = hit(`pay:${req.ip ?? 'x'}`, 20, 60_000, 15_000);
    if (!limited.allowed) {
      res.status(429).json({ error: 'Too many payment attempts.' });
      return;
    }
    const schema = z.object({
      orderId: z.string().min(4).max(80),
      cardNumber: z.string().min(12).max(24),
      exp: z.string().max(8).optional(),
      cvc: z.string().max(4).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Card details missing.' });
      return;
    }
    const order = getSandboxOrder(parsed.data.orderId);
    if (!order || order.paid) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    const verdict = evaluateTestCard(parsed.data.cardNumber);
    if (verdict === 'decline') {
      res.status(402).json({ error: 'Your card was declined. (Stripe test card 4000 0000 0000 0002)' });
      return;
    }
    if (verdict === 'insufficient') {
      res.status(402).json({ error: 'Insufficient funds. (Stripe test card 4000 0000 0000 9995)' });
      return;
    }
    if (verdict !== 'ok') {
      res.status(400).json({
        error: 'Use Stripe test card 4242 4242 4242 4242. Any future expiry and any CVC.',
      });
      return;
    }
    markSandboxPaid(order.id);
    const issued = issuePurchase({
      plan: order.plan,
      kind: order.kind,
      seats: order.extraSeats ?? order.seats,
      durationMs: order.durationMs,
      amountPaidCents: Math.round(order.amountUsd * 100),
      stripeSessionId: `sandbox_${order.id}`,
      attachPassId: order.attachPassId,
      extraSeats: order.extraSeats,
    });
    res.json(passPublic(issued.pass, issued.code));
  });

  api.post('/claim', async (req, res) => {
    const schema = z.object({ sessionId: z.string().min(8).max(256) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing Checkout session.' });
      return;
    }
    if (!stripeEnabled()) {
      res.status(503).json({ error: 'Stripe is not configured on this server.' });
      return;
    }
    try {
      const claimed = await entitlementFromCheckout(parsed.data.sessionId);
      if (!claimed) {
        res.status(402).json({ error: 'Payment is not complete yet.' });
        return;
      }
      const pass = findById(claimed.passId);
      res.json({
        token: claimed.token,
        passCode: claimed.passCode,
        passId: claimed.passId,
        plan: claimed.entitlement.plan,
        expiresAt: claimed.entitlement.exp * 1000,
        kind: claimed.entitlement.kind,
        seats: claimed.entitlement.seats,
        roomCode: pass?.roomCode,
        limits: limitsForPlan(claimed.entitlement.plan, {
          seats: claimed.entitlement.seats ?? 20,
          durationMs: claimed.entitlement.durationMs ?? 0,
        }),
      });
    } catch (err) {
      console.warn('stripe claim failed', err);
      res.status(502).json({ error: 'Unable to confirm payment with Stripe.' });
    }
  });

  api.post('/redeem', (req, res) => {
    const limited = hit(`redeem:${req.ip ?? 'x'}`, 10, 60_000, 20_000);
    if (!limited.allowed) {
      res.status(429).json({ error: 'Too many redeem attempts. Wait a minute.' });
      return;
    }
    const schema = z.object({ passCode: z.string().min(10).max(40) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Enter a CCHAT pass code.' });
      return;
    }
    const pass = findByCode(parsed.data.passCode);
    if (!pass || pass.revoked || pass.expiresAt < Date.now()) {
      res.status(404).json({ error: 'Pass not found or expired.' });
      return;
    }
    res.json(passPublic(pass));
  });

  api.post('/refund', async (req, res) => {
    const schema = z.object({ passCode: z.string().min(10).max(40) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Pass code required.' });
      return;
    }
    const pass = findByCode(parsed.data.passCode);
    if (!pass || pass.kind !== 'party') {
      res.status(404).json({ error: 'Party pass not found.' });
      return;
    }
    const amount = refundableCents(pass);
    if (amount < 50) {
      res.status(400).json({ error: 'Nothing left to refund. Unused invites are already used or too small.' });
      return;
    }
    if (pass.stripePaymentIntentId && stripeEnabled()) {
      try {
        await refundStripe(pass.stripePaymentIntentId, amount);
      } catch (err) {
        console.warn('stripe refund failed', err);
        res.status(502).json({ error: 'Stripe could not issue the refund.' });
        return;
      }
    }
    pass.refundedCents += amount;
    pass.seats = pass.peakJoins;
    updatePass(pass.id, pass);
    res.json({
      ok: true,
      refundedCents: amount,
      refundedUsd: amount / 100,
      remainingSeats: pass.seats,
      sandbox: !stripeEnabled(),
    });
  });

  api.post('/portal', async (req, res) => {
    if (!stripeEnabled()) {
      res.status(503).json({ error: 'Stripe Customer Portal needs STRIPE_SECRET_KEY.' });
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

export { noteJoin };
