import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { issueEntitlement, verifyEntitlement } from '../server/src/billing/entitlement.ts';
import { generatePassCode, hashPassCode, issuePurchase, findByCode } from '../server/src/billing/passes.ts';
import { evaluateTestCard } from '../server/src/billing/sandbox.ts';
import { createServer } from '../server/src/index.ts';

describe('entitlements', () => {
  it('signs and verifies a Plus token', () => {
    const token = issueEntitlement({
      plan: 'plus',
      customerId: 'cus_test',
      expiresAt: Date.now() + 86_400_000,
    });
    const ent = verifyEntitlement(token);
    expect(ent?.plan).toBe('plus');
    expect(ent?.sub).toBe('cus_test');
  });

  it('signs a party pass token', () => {
    const token = issueEntitlement({
      plan: 'party',
      customerId: 'pass_1',
      expiresAt: Date.now() + 86_400_000,
      kind: 'party',
      seats: 16,
    });
    expect(verifyEntitlement(token)?.plan).toBe('party');
  });

  it('rejects tampered tokens', () => {
    const token = issueEntitlement({
      plan: 'pro',
      customerId: 'cus_test',
      expiresAt: Date.now() + 86_400_000,
    });
    expect(verifyEntitlement(token.slice(0, -2) + 'ab')).toBeNull();
    expect(verifyEntitlement('not-a-token')).toBeNull();
    expect(verifyEntitlement(undefined)).toBeNull();
  });

  it('rejects expired tokens', () => {
    const token = issueEntitlement({
      plan: 'plus',
      customerId: 'cus_old',
      expiresAt: Date.now() - 120_000,
    });
    expect(verifyEntitlement(token)).toBeNull();
  });
});

describe('anonymous passes', () => {
  it('hashes codes and issues a recoverable pass', () => {
    const code = generatePassCode();
    expect(code).toMatch(/^CCHAT-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const { pass, code: shown } = issuePurchase({
      plan: 'party',
      kind: 'party',
      seats: 8,
      durationMs: 2 * 3600_000,
      amountPaidCents: 600,
    });
    expect(shown).toBeTruthy();
    expect(findByCode(shown!)?.id).toBe(pass.id);
    expect(hashPassCode(shown!)).toBe(pass.hash);
  });

  it('recognizes Stripe test cards', () => {
    expect(evaluateTestCard('4242424242424242')).toBe('ok');
    expect(evaluateTestCard('4000000000000002')).toBe('decline');
    expect(evaluateTestCard('4000000000009995')).toBe('insufficient');
    expect(evaluateTestCard('1234')).toBe('invalid');
  });
});

describe('billing HTTP', () => {
  const { app, server, manager } = createServer();

  afterAll(async () => {
    manager.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('lists plans without secrets', async () => {
    const res = await request(app).get('/api/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans.plus.maxParticipants).toBeGreaterThan(res.body.plans.free.maxParticipants);
    expect(res.body.party.length).toBeGreaterThan(2);
    expect(JSON.stringify(res.body)).not.toMatch(/sk_live|sk_test_|whsec_/);
  });

  it('reports free status without a token', async () => {
    const res = await request(app).get('/api/billing/status');
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('free');
    expect(res.body.active).toBe(false);
  });

  it('starts sandbox checkout without Stripe keys', async () => {
    const res = await request(app).post('/api/billing/checkout').send({ priceKey: 'party_spark' });
    expect(res.status).toBe(200);
    expect(res.body.sandbox).toBe(true);
    expect(res.body.url).toMatch(/pay\/sandbox/);
  });

  it('pays with Stripe test PAN 4242 and returns a pass code', async () => {
    const start = await request(app).post('/api/billing/checkout').send({ priceKey: 'party_spark' });
    const orderId = start.body.id as string;
    const pay = await request(app)
      .post('/api/billing/sandbox/pay')
      .send({ orderId, cardNumber: '4242424242424242', exp: '12/34', cvc: '123' });
    expect(pay.status).toBe(200);
    expect(pay.body.passCode).toMatch(/^CCHAT-/);
    expect(pay.body.token).toBeTruthy();
    const redeem = await request(app).post('/api/billing/redeem').send({ passCode: pay.body.passCode });
    expect(redeem.status).toBe(200);
    expect(redeem.body.plan).toBe('party');
  });

  it('declines Stripe test card 4000 0000 0000 0002', async () => {
    const start = await request(app).post('/api/billing/checkout').send({ priceKey: 'plus_monthly' });
    const pay = await request(app)
      .post('/api/billing/sandbox/pay')
      .send({ orderId: start.body.id, cardNumber: '4000000000000002' });
    expect(pay.status).toBe(402);
  });

  it('rejects unsigned webhooks', async () => {
    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .send({ type: 'ping' });
    expect([400, 503]).toContain(res.status);
  });

  it('exposes billingEnabled on public config', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.billingEnabled).toBe(true);
  });
});
