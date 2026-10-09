import { randomBytes } from 'node:crypto';
import { STRIPE_TEST_CARDS } from '../../../shared/billing.ts';

export interface SandboxOrder {
  id: string;
  priceKey: string;
  amountUsd: number;
  plan: 'plus' | 'pro' | 'party';
  kind: 'sub' | 'party';
  seats: number;
  durationMs: number;
  extraSeats?: number;
  attachPassId?: string;
  createdAt: number;
  paid?: boolean;
}

const orders = new Map<string, SandboxOrder>();

export function createSandboxOrder(order: Omit<SandboxOrder, 'id' | 'createdAt'>): SandboxOrder {
  const rec: SandboxOrder = {
    ...order,
    id: `ord_${randomBytes(8).toString('hex')}`,
    createdAt: Date.now(),
  };
  orders.set(rec.id, rec);
  return rec;
}

export function getSandboxOrder(id: string): SandboxOrder | undefined {
  return orders.get(id);
}

export function markSandboxPaid(id: string): SandboxOrder | undefined {
  const o = orders.get(id);
  if (!o) return undefined;
  o.paid = true;
  return o;
}

/** Stripe's documented test PANs. https://docs.stripe.com/testing */
export function evaluateTestCard(number: string): 'ok' | 'decline' | 'insufficient' | 'invalid' {
  const digits = number.replace(/\D/g, '');
  if (digits === STRIPE_TEST_CARDS.success) return 'ok';
  if (digits === STRIPE_TEST_CARDS.decline) return 'decline';
  if (digits === STRIPE_TEST_CARDS.insufficient) return 'insufficient';
  if (digits.length === 16 && luhn(digits)) return 'invalid';
  return 'invalid';
}

function luhn(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = Number(num[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}
