export const LEGAL_STORAGE_KEY = 'cipherchat.legal.v1';
export const LEGAL_VERSION = 1;

export interface LegalAccept {
  v: number;
  at: number;
  age18: true;
  accepted: true;
}

export function readLegalAccept(): LegalAccept | null {
  try {
    const raw = localStorage.getItem(LEGAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LegalAccept>;
    if (parsed?.v === LEGAL_VERSION && parsed.age18 === true && parsed.accepted === true && typeof parsed.at === 'number') {
      return parsed as LegalAccept;
    }
  } catch {
    /* private mode / corrupt */
  }
  return null;
}

export function writeLegalAccept() {
  const rec: LegalAccept = { v: LEGAL_VERSION, at: Date.now(), age18: true, accepted: true };
  try {
    localStorage.setItem(LEGAL_STORAGE_KEY, JSON.stringify(rec));
  } catch {
    try {
      sessionStorage.setItem(LEGAL_STORAGE_KEY, JSON.stringify(rec));
    } catch {
      /* ignore */
    }
  }
}

export function hasLegalAccept() {
  if (readLegalAccept()) return true;
  try {
    const raw = sessionStorage.getItem(LEGAL_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<LegalAccept>;
    return parsed?.v === LEGAL_VERSION && parsed.accepted === true && parsed.age18 === true;
  } catch {
    return false;
  }
}
