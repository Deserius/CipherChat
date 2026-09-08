import 'dotenv/config';
import { defaultIceServers } from './webrtc/ice.ts';

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === '1' || raw.toLowerCase() === 'true' || raw === 'yes';
}

const roomCodeLength = Math.min(10, Math.max(4, intEnv('ROOM_CODE_LENGTH', 6)));

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  port: intEnv('PORT', 3000),
  appUrl: process.env.APP_URL ?? `http://localhost:${intEnv('PORT', 3000)}`,
  extraOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  allowFraming: boolEnv('ALLOW_FRAMING', false),
  trustProxy: boolEnv('TRUST_PROXY', false),

  roomCodeLength,
  maxParticipants: intEnv('ROOM_MAX_PARTICIPANTS', 12),
  participantGraceMs: intEnv('PARTICIPANT_GRACE_MS', 15_000),
  roomDestroyGraceMs: intEnv('ROOM_DESTROY_GRACE_MS', 30_000),
  roomMaxLifetimeMs: intEnv('ROOM_MAX_LIFETIME_MS', 4 * 60 * 60 * 1000),
  roomInactivityMs: intEnv('ROOM_INACTIVITY_MS', 60 * 60 * 1000),

  maxMessageChars: intEnv('MAX_MESSAGE_CHARS', 4000),
  maxFileBytes: intEnv('MAX_FILE_BYTES', 8 * 1024 * 1024),
  maxWsPayloadBytes: intEnv('MAX_WS_PAYLOAD_BYTES', 10 * 1024 * 1024),

  rateLimitWindowMs: intEnv('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMaxHttp: intEnv('RATE_LIMIT_MAX_HTTP', 120),
  rateLimitMaxJoin: intEnv('RATE_LIMIT_MAX_JOIN', 20),
  rateLimitMaxCreate: intEnv('RATE_LIMIT_MAX_CREATE', 10),
  wsMaxConnectionsPerIp: intEnv('WS_MAX_CONNECTIONS_PER_IP', 20),
  messageRateMax: intEnv('MESSAGE_RATE_MAX', 30),
  messageRateWindowMs: intEnv('MESSAGE_RATE_WINDOW_MS', 10_000),

  stunServers: (process.env.STUN_SERVER ??
    'stun:stun.cloudflare.com:3478,stun:stun.l.google.com:19302')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  turnServer: process.env.TURN_SERVER ?? '',
  turnUsername: process.env.TURN_USERNAME ?? '',
  turnPassword: process.env.TURN_PASSWORD ?? '',
  turnsServer: process.env.TURNS_SERVER ?? '',

  redisUrl: process.env.REDIS_URL ?? '',

  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
};

export function iceServers() {
  return defaultIceServers({
    stunServers: config.stunServers,
    turnServer: config.turnServer,
    turnUsername: config.turnUsername,
    turnPassword: config.turnPassword,
    turnsServer: config.turnsServer,
  });
}

export function publicConfig() {
  return {
    maxParticipants: config.maxParticipants,
    maxMessageChars: config.maxMessageChars,
    maxFileBytes: config.maxFileBytes,
    roomCodeMin: 4,
    roomCodeMax: 10,
    twilioEnabled: Boolean(
      config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber,
    ),
    stunConfigured: config.stunServers.length > 0,
    turnConfigured: Boolean(config.turnServer && config.turnUsername && config.turnPassword),
  };
}
