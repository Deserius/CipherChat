/**
 * In-memory sliding-window rate limiter.
 * Keys are hashed/truncated so full IPs are not retained longer than the window.
 * This is operational abuse-prevention, not analytics.
 */

interface Bucket {
  timestamps: number[];
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

function prune(b: Bucket, now: number, windowMs: number) {
  const cutoff = now - windowMs;
  b.timestamps = b.timestamps.filter((t) => t > cutoff);
}

export function hit(key: string, limit: number, windowMs: number, lockMs = 0): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
} {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { timestamps: [], lockedUntil: 0 };
    buckets.set(key, b);
  }
  if (b.lockedUntil > now) {
    return { allowed: false, remaining: 0, retryAfterMs: b.lockedUntil - now };
  }
  prune(b, now, windowMs);
  if (b.timestamps.length >= limit) {
    if (lockMs > 0) b.lockedUntil = now + lockMs;
    return { allowed: false, remaining: 0, retryAfterMs: windowMs };
  }
  b.timestamps.push(now);
  return { allowed: true, remaining: limit - b.timestamps.length, retryAfterMs: 0 };
}

export function connectionCounter() {
  const counts = new Map<string, number>();
  return {
    inc(ip: string): number {
      const n = (counts.get(ip) ?? 0) + 1;
      counts.set(ip, n);
      return n;
    },
    dec(ip: string): void {
      const n = (counts.get(ip) ?? 1) - 1;
      if (n <= 0) counts.delete(ip);
      else counts.set(ip, n);
    },
    get(ip: string): number {
      return counts.get(ip) ?? 0;
    },
  };
}

// Periodic cleanup so the map cannot grow without bound
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.lockedUntil < now && (b.timestamps.length === 0 || b.timestamps.every((t) => t < now - 120_000))) {
      buckets.delete(k);
    }
  }
}, 60_000).unref();
