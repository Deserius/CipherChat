import { z } from 'zod';

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'invalid-name')
  .max(32, 'invalid-name')
  .refine((s) => !/[\u0000-\u001F\u007F]/.test(s), 'invalid-name');

export const roomCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,10}$/, 'invalid-room-code');

export function sanitizeDisplayName(raw: unknown): string {
  const parsed = displayNameSchema.safeParse(raw);
  if (!parsed.success) throw Object.assign(new Error('invalid-name'), { code: 'invalid-name' });
  // Strip characters that can confuse UI / screen readers, keep unicode letters.
  return parsed.data.replace(/\s+/g, ' ');
}

export function parseRoomCode(raw: unknown): string {
  const parsed = roomCodeSchema.safeParse(raw);
  if (!parsed.success) throw Object.assign(new Error('invalid-room-code'), { code: 'invalid-room-code' });
  return parsed.data;
}

const ALLOWED_EMOJI = /^[\p{Emoji}\p{Emoji_Component}\s]{1,8}$/u;

export function isAllowedEmoji(s: string): boolean {
  return ALLOWED_EMOJI.test(s) && s.length <= 16;
}

export function isSafeClientId(s: unknown): s is string {
  return typeof s === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(s);
}
