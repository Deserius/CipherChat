import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { issueEntitlement, verifyEntitlement } from '../server/src/billing/entitlement.ts';
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

describe('billing HTTP', () => {
  const { app, server, manager } = createServer();

  afterAll(async () => {
    manager.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('lists plans without secrets', async () => {
    const res = await request(app).get('/api/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.processor).toBe('stripe');
    expect(res.body.plans.plus.maxParticipants).toBeGreaterThan(res.body.plans.free.maxParticipants);
    expect(JSON.stringify(res.body)).not.toMatch(/sk_live|sk_test|whsec_/);
  });

  it('reports free status without a token', async () => {
    const res = await request(app).get('/api/billing/status');
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('free');
    expect(res.body.active).toBe(false);
  });

  it('does not start checkout without Stripe keys', async () => {
    const res = await request(app).post('/api/billing/checkout').send({ priceKey: 'plus_monthly' });
    expect(res.status).toBe(503);
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
    expect(typeof res.body.billingEnabled).toBe('boolean');
  });
});
