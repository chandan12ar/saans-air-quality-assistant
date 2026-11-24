export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * In-memory sliding-window limiter. On serverless platforms each instance keeps its own
 * counters, so this is best-effort abuse protection, not a hard global quota.
 */
export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number; now?: () => number }) {
  const { limit, windowMs } = opts;
  const maxKeys = opts.maxKeys ?? 5000;
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();

  return function check(key: string): RateLimitResult {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      const oldest = recent[0] ?? t;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - t) / 1000)) };
    }
    recent.push(t);
    hits.delete(key);
    hits.set(key, recent);
    while (hits.size > maxKeys) {
      const first = hits.keys().next().value;
      if (first === undefined) break;
      hits.delete(first);
    }
    return { allowed: true, retryAfterSeconds: 0 };
  };
}
