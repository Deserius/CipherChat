import { createHmac, timingSafeEqual } from 'node:crypto';
import { PLAN_LIMITS, type PlanId } from '../../../shared/billing.ts';
import { config } from '../config.ts';

export interface Entitlement {
  v: 1;
  plan: Exclude<PlanId, 'free'>;
  sub: string;
  exp: number;
  iat: number;
}

function secret(): string {
  return config.entitlementSecret || config.stripeSecretKey || 'cipherchat-dev-entitlement';
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64url');
}

function sign(payloadB64: string): string {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

export function issueEntitlement(input: {
  plan: Exclude<PlanId, 'free'>;
  customerId: string;
  expiresAt: number;
}): string {
  const body: Entitlement = {
    v: 1,
    plan: input.plan,
    sub: input.customerId,
    exp: Math.floor(input.expiresAt / 1000),
    iat: Math.floor(Date.now() / 1000),
  };
  const payload = b64url(JSON.stringify(body));
  return `${payload}.${sign(payload)}`;
}

export function verifyEntitlement(token: string | undefined | null): Entitlement | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Entitlement;
    if (body.v !== 1) return null;
    if (body.plan !== 'plus' && body.plan !== 'pro') return null;
    if (!body.sub || typeof body.sub !== 'string') return null;
    if (body.exp * 1000 < Date.now() - 60_000) return null;
    return body;
  } catch {
    return null;
  }
}

export function limitsFor(plan: PlanId | undefined) {
  return PLAN_LIMITS[plan && plan in PLAN_LIMITS ? plan : 'free'];
}
