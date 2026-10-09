import { ENTITLEMENT_STORAGE_KEY, PASS_STORAGE_KEY, limitsForPlan, type PlanId } from '@shared/billing';

export interface LocalEntitlement {
  token: string;
  plan: Exclude<PlanId, 'free'>;
  expiresAt: number;
  passCode?: string;
  passId?: string;
  kind?: 'sub' | 'party';
  seats?: number;
  roomCode?: string;
}

function read(): LocalEntitlement | null {
  try {
    const raw = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalEntitlement;
    if (!parsed?.token) return null;
    if (parsed.plan !== 'plus' && parsed.plan !== 'pro' && parsed.plan !== 'party') return null;
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      localStorage.removeItem(ENTITLEMENT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getEntitlement(): LocalEntitlement | null {
  return read();
}

export function getPlan(): PlanId {
  return read()?.plan ?? 'free';
}

export function entitlementToken(): string | undefined {
  return read()?.token;
}

export function passCode(): string | undefined {
  try {
    return localStorage.getItem(PASS_STORAGE_KEY) || read()?.passCode;
  } catch {
    return read()?.passCode;
  }
}

export function saveEntitlement(data: LocalEntitlement) {
  const stored = { ...data };
  if (data.passCode) {
    try {
      localStorage.setItem(PASS_STORAGE_KEY, data.passCode);
    } catch {
      /* private mode */
    }
  }
  localStorage.setItem(ENTITLEMENT_STORAGE_KEY, JSON.stringify(stored));
}

export function clearEntitlement() {
  localStorage.removeItem(ENTITLEMENT_STORAGE_KEY);
  localStorage.removeItem(PASS_STORAGE_KEY);
}

export function currentLimits() {
  const e = read();
  return limitsForPlan(e?.plan ?? 'free', e?.seats ? { seats: e.seats, durationMs: Math.max(0, e.expiresAt - Date.now()) } : undefined);
}
