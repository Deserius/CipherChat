import { ENTITLEMENT_STORAGE_KEY, PLAN_LIMITS, type PlanId } from '@shared/billing';

export interface LocalEntitlement {
  token: string;
  plan: Exclude<PlanId, 'free'>;
  expiresAt: number;
}

function read(): LocalEntitlement | null {
  try {
    const raw = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalEntitlement;
    if (!parsed?.token || (parsed.plan !== 'plus' && parsed.plan !== 'pro')) return null;
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

export function saveEntitlement(data: LocalEntitlement) {
  localStorage.setItem(ENTITLEMENT_STORAGE_KEY, JSON.stringify(data));
}

export function clearEntitlement() {
  localStorage.removeItem(ENTITLEMENT_STORAGE_KEY);
}

export function currentLimits() {
  return PLAN_LIMITS[getPlan()];
}
