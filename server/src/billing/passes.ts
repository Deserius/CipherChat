import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlanId } from '../../../shared/billing.ts';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data');
const file = path.join(dir, 'passes.json');

export interface StoredPass {
  id: string;
  hash: string;
  kind: 'sub' | 'party';
  plan: Exclude<PlanId, 'free'>;
  seats: number;
  peakJoins: number;
  durationMs: number;
  createdAt: number;
  expiresAt: number;
  roomCode?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  amountPaidCents: number;
  refundedCents: number;
  revoked: boolean;
}

interface StoreFile {
  passes: StoredPass[];
}

let cache: StoreFile | null = null;

function load(): StoreFile {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    cache = JSON.parse(raw) as StoreFile;
    if (!Array.isArray(cache.passes)) cache = { passes: [] };
  } catch {
    cache = { passes: [] };
  }
  return cache;
}

function save() {
  const data = load();
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function hashPassCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

/** CCHAT-XXXX-XXXX-XXXX — 72 bits, Crockford-ish. Shown once. */
export function generatePassCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  let body = '';
  for (let i = 0; i < 12; i++) body += alphabet[bytes[i]! % alphabet.length];
  return `CCHAT-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

export function normalizePassCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function createPass(input: Omit<StoredPass, 'id' | 'hash' | 'peakJoins' | 'refundedCents' | 'revoked' | 'createdAt'> & { code: string }): StoredPass {
  const rec: StoredPass = {
    id: randomBytes(8).toString('hex'),
    hash: hashPassCode(input.code),
    kind: input.kind,
    plan: input.plan,
    seats: input.seats,
    peakJoins: 0,
    durationMs: input.durationMs,
    createdAt: Date.now(),
    expiresAt: input.expiresAt,
    roomCode: input.roomCode,
    stripeSessionId: input.stripeSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId,
    amountPaidCents: input.amountPaidCents,
    refundedCents: 0,
    revoked: false,
  };
  load().passes.push(rec);
  save();
  return rec;
}

export function findByCode(code: string): StoredPass | undefined {
  const hash = hashPassCode(normalizePassCode(code));
  return load().passes.find((p) => p.hash === hash);
}

export function findById(id: string): StoredPass | undefined {
  return load().passes.find((p) => p.id === id);
}

export function findByStripeSession(sessionId: string): StoredPass | undefined {
  return load().passes.find((p) => p.stripeSessionId === sessionId);
}

export function updatePass(id: string, patch: Partial<StoredPass>): StoredPass | undefined {
  const rec = findById(id);
  if (!rec) return undefined;
  Object.assign(rec, patch);
  save();
  return rec;
}

export function noteJoin(pass: StoredPass, occupancy: number) {
  if (occupancy > pass.peakJoins) {
    pass.peakJoins = occupancy;
    save();
  }
}

export function unusedSeats(pass: StoredPass): number {
  return Math.max(0, pass.seats - pass.peakJoins);
}

export function refundableCents(pass: StoredPass): number {
  if (pass.revoked || pass.amountPaidCents <= 0) return 0;
  if (pass.kind !== 'party') return 0;
  const unused = unusedSeats(pass);
  if (unused <= 0) return 0;
  const remaining = pass.amountPaidCents - pass.refundedCents;
  return Math.floor((unused / pass.seats) * remaining);
}

export function issuePurchase(input: {
  plan: Exclude<PlanId, 'free'>;
  kind: 'sub' | 'party';
  seats: number;
  durationMs: number;
  amountPaidCents: number;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  attachPassId?: string;
  extraSeats?: number;
}): { pass: StoredPass; code?: string } {
  if (input.attachPassId && input.extraSeats) {
    const existing = findById(input.attachPassId);
    if (existing && !existing.revoked) {
      existing.seats += input.extraSeats;
      existing.amountPaidCents += input.amountPaidCents;
      existing.expiresAt = Math.max(existing.expiresAt, Date.now() + 60_000);
      updatePass(existing.id, existing);
      return { pass: existing };
    }
  }
  const found = input.stripeSessionId ? findByStripeSession(input.stripeSessionId) : undefined;
  if (found) return { pass: found };
  const code = generatePassCode();
  const pass = createPass({
    code,
    kind: input.kind,
    plan: input.plan,
    seats: input.seats,
    durationMs: input.durationMs,
    expiresAt: Date.now() + input.durationMs,
    stripeSessionId: input.stripeSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId,
    amountPaidCents: input.amountPaidCents,
  });
  return { pass, code };
}
