import { randomBytes, randomInt } from 'node:crypto';

/** Cryptographically secure room code with no leading zero. */
export function generateRoomCode(digits: number): string {
  const n = Math.min(10, Math.max(4, digits));
  const min = 10 ** (n - 1);
  const max = 10 ** n - 1;
  return String(randomInt(min, max + 1));
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function generateId(): string {
  return randomBytes(16).toString('hex');
}
