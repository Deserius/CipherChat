/** Plan catalog. Amounts are USD. Stripe Price IDs come from the server when live keys exist. */

export type PlanId = 'free' | 'plus' | 'pro' | 'party';
export type PriceKey =
  | 'plus_monthly'
  | 'plus_yearly'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'party_spark'
  | 'party_house'
  | 'party_night'
  | 'party_weekend'
  | 'party_addon';

export interface PlanLimits {
  maxParticipants: number;
  maxFileBytes: number;
  hdVideo: boolean;
  videoBitrate: number;
  screenFps: number;
  holdMs: number;
  maxLifetimeMs: number;
}

export const PLAN_LIMITS: Record<Exclude<PlanId, 'party'>, PlanLimits> = {
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

export function limitsForPlan(plan: PlanId, party?: { seats: number; durationMs: number }): PlanLimits {
  if (plan === 'party' && party) {
    return {
      maxParticipants: party.seats,
      maxFileBytes: 32 * 1024 * 1024,
      hdVideo: true,
      videoBitrate: 2_500_000,
      screenFps: 30,
      holdMs: party.durationMs,
      maxLifetimeMs: party.durationMs,
    };
  }
  if (plan === 'party') return PLAN_LIMITS.plus;
  return PLAN_LIMITS[plan];
}

export const PRICE_CATALOG: Record<
  Extract<PriceKey, 'plus_monthly' | 'plus_yearly' | 'pro_monthly' | 'pro_yearly'>,
  { plan: 'plus' | 'pro'; interval: 'month' | 'year'; amountUsd: number; label: string }
> = {
  plus_monthly: { plan: 'plus', interval: 'month', amountUsd: 8, label: 'Plus monthly' },
  plus_yearly: { plan: 'plus', interval: 'year', amountUsd: 72, label: 'Plus yearly' },
  pro_monthly: { plan: 'pro', interval: 'month', amountUsd: 18, label: 'Pro monthly' },
  pro_yearly: { plan: 'pro', interval: 'year', amountUsd: 168, label: 'Pro yearly' },
};

export interface PartyPack {
  key: Extract<PriceKey, 'party_spark' | 'party_house' | 'party_night' | 'party_weekend'>;
  name: string;
  seats: number;
  hours: number;
  amountUsd: number;
  blurb: string;
}

export const PARTY_PACKS: PartyPack[] = [
  { key: 'party_spark', name: 'Spark', seats: 8, hours: 2, amountUsd: 6, blurb: 'Quick hangout. HD, 8 guests, 2 hours.' },
  { key: 'party_house', name: 'House', seats: 16, hours: 6, amountUsd: 12, blurb: 'Dinner, game night, or class reunion.' },
  { key: 'party_night', name: 'Night', seats: 32, hours: 12, amountUsd: 22, blurb: 'A full night. Extra invites available after.' },
  { key: 'party_weekend', name: 'Weekend', seats: 40, hours: 48, amountUsd: 39, blurb: 'Keep the room code all weekend.' },
];

/** Extra invite after a party is purchased. */
export const PARTY_ADDON_USD = 2;

export const STRIPE_TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  insufficient: '4000000000009995',
};

export const ENTITLEMENT_STORAGE_KEY = 'cipherchat.entitlement';
export const PASS_STORAGE_KEY = 'cipherchat.pass';
