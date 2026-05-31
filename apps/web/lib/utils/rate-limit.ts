/**
 * In-memory sliding-window rate limiter. Suitable for single-instance dev/staging
 * and as a defense-in-depth layer in front of infrastructure-level limiting in
 * prod. For multi-instance deployments use a shared store (Redis / Upstash /
 * Vercel KV) — the same interface drops in.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  options: { maxAttempts: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.maxAttempts - 1, resetAt };
  }

  if (bucket.count >= options.maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: options.maxAttempts - bucket.count,
    resetAt: bucket.resetAt,
  };
}

/** Extract the caller's IP from common proxy headers. Falls back to "unknown". */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Periodically prune stale buckets so memory doesn't grow unbounded. */
function prune() {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

// Run roughly every 5 minutes. In serverless this may never fire (cold start
// resets memory anyway); in long-lived runtimes it keeps the map small.
if (typeof setInterval !== "undefined") {
  setInterval(prune, 5 * 60 * 1000).unref?.();
}
