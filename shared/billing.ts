/** Plan catalog. Amounts are USD cents. Stripe Price IDs come from the server. */

export type PlanId = 'free' | 'plus' | 'pro';
export type PriceKey = 'plus_monthly' | 'plus_yearly' | 'pro_monthly' | 'pro_yearly';

export interface PlanLimits {
  maxParticipants: number;
  maxFileBytes: number;
  hdVideo: boolean;
  videoBitrate: number;
  screenFps: number;
  holdMs: number;
  maxLifetimeMs: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxParticipants: 12,
    maxFileBytes: 8 * 1024 * 1024,
    hdVideo: false,
    videoBitrate: 1_200_000,
    screenFps: 15,
    holdMs: 30_000,
    maxLifetimeMs: 4 * 60 * 60 * 1000,
  },
  plus: {
    maxParticipants: 20,
    maxFileBytes: 32 * 1024 * 1024,
    hdVideo: true,
    videoBitrate: 2_500_000,
    screenFps: 30,
    holdMs: 24 * 60 * 60 * 1000,
    maxLifetimeMs: 24 * 60 * 60 * 1000,
  },
  pro: {
    maxParticipants: 40,
    maxFileBytes: 80 * 1024 * 1024,
    hdVideo: true,
    videoBitrate: 4_000_000,
    screenFps: 30,
    holdMs: 7 * 24 * 60 * 60 * 1000,
    maxLifetimeMs: 7 * 24 * 60 * 60 * 1000,
  },
};

export const PRICE_CATALOG: Record<
  PriceKey,
  { plan: Exclude<PlanId, 'free'>; interval: 'month' | 'year'; amountUsd: number; label: string }
> = {
  plus_monthly: { plan: 'plus', interval: 'month', amountUsd: 8, label: 'Plus monthly' },
  plus_yearly: { plan: 'plus', interval: 'year', amountUsd: 72, label: 'Plus yearly' },
  pro_monthly: { plan: 'pro', interval: 'month', amountUsd: 18, label: 'Pro monthly' },
  pro_yearly: { plan: 'pro', interval: 'year', amountUsd: 168, label: 'Pro yearly' },
};

export const ENTITLEMENT_STORAGE_KEY = 'cipherchat.entitlement';
