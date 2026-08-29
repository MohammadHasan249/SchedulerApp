/**
 * Rate limiter with Upstash Redis in production and an in-memory sliding-window
 * fallback for local dev. Set KV_REST_API_URL + KV_REST_API_TOKEN (as provisioned
 * by the Vercel Marketplace Upstash integration) to enable the distributed
 * backend; without them the in-memory store is used (safe for single-instance /
 * local; not safe for multi-instance prod).
 */

// ── In-memory fallback ────────────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function inMemoryCheck(
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

// ── Upstash Redis backend ─────────────────────────────────────────────────────

const hasUpstash =
  !!process.env.KV_REST_API_URL &&
  !!process.env.KV_REST_API_TOKEN;

// Cache one Ratelimit instance per (maxAttempts, windowMs) pair to avoid
// constructing a new object on every request.
const limiterCache = new Map<string, unknown>();

async function upstashCheck(
  key: string,
  options: { maxAttempts: number; windowMs: number }
): Promise<RateLimitResult> {
  const cacheKey = `${options.maxAttempts}:${options.windowMs}`;
  if (!limiterCache.has(cacheKey)) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    limiterCache.set(
      cacheKey,
      new Ratelimit({
        redis: new Redis({
          url: process.env.KV_REST_API_URL!,
          token: process.env.KV_REST_API_TOKEN!,
        }),
        limiter: Ratelimit.slidingWindow(options.maxAttempts, `${options.windowMs}ms`),
        ephemeralCache: new Map(),
      })
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const limiter = limiterCache.get(cacheKey) as any;
  const result = await limiter.limit(key);
  return {
    allowed: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkRateLimit(
  key: string,
  options: { maxAttempts: number; windowMs: number }
): Promise<RateLimitResult> {
  if (hasUpstash) {
    try {
      return await upstashCheck(key, options);
    } catch {
      // Redis outage degrades to in-memory; a Redis blip shouldn't take down
      // clock-in / AI endpoints entirely.
    }
  }
  return inMemoryCheck(key, options);
}

/** Extract the caller's IP from common proxy headers. Falls back to "unknown". */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// Periodically prune stale in-memory buckets.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if ((b as Bucket).resetAt <= now) buckets.delete(k);
    }
  }, 5 * 60 * 1000).unref?.();
}
