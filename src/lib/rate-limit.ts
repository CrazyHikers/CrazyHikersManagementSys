// Distributed rate limiter backed by Upstash Redis. Replaces the previous
// in-memory Map which only worked per Vercel Fluid Compute instance — an
// attacker spreading load across instances would have effectively bypassed
// it. With Upstash, counts are shared across all instances of all regions.
//
// Behaviour when Upstash env vars are not configured (local dev, preview
// deploys without the secrets, or an outage): we FAIL OPEN — allow the
// request and log loudly. Rate limiting is defence in depth, not the
// primary auth boundary, so an outage of the limiter must not lock the
// app out of itself.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** ms until the limit resets. 0 when the limiter is disabled. */
  resetIn: number;
};

// One shared Redis client per process. Upstash's REST client is HTTP-based
// so there's no connection to keep alive — but caching the instance avoids
// re-parsing env on every request.
let redis: Redis | null = null;
let warnedMissingEnv = false;

function getRedis(): Redis | null {
  if (redis) return redis;
  // Support both connection conventions. A manual Upstash setup uses the
  // UPSTASH_REDIS_REST_* names (also what Redis.fromEnv() expects); the
  // Vercel-Upstash marketplace integration injects the Vercel-KV-style
  // KV_REST_API_* names instead. We can't use Redis.fromEnv() because it
  // only knows the former and throws on missing — we want to read either
  // and fail open if neither is present.
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      // error level (not warn): a disabled rate limiter is an operational
      // failure of a security control, and `error` is the level most
      // reliably surfaced by Vercel logs and log drains.
      console.error(
        "[rate-limit] No Redis credentials found (checked UPSTASH_REDIS_REST_URL/" +
          "_TOKEN and KV_REST_API_URL/_TOKEN) — rate limiting is DISABLED. " +
          "Connect Upstash in Vercel or set these vars to enable."
      );
    }
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

// Limiters are keyed by (maxAttempts, windowMs) so call sites with the
// same parameters share an instance. The Upstash sliding-window algorithm
// is more accurate than a fixed window and matches what the previous code
// roughly intended (a rolling N-attempts-per-window check).
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(maxAttempts: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const cacheKey = `${maxAttempts}:${windowMs}`;
  const existing = limiterCache.get(cacheKey);
  if (existing) return existing;
  const limiter = new Ratelimit({
    redis: r,
    // slidingWindow(N, "<duration>") — Upstash duration strings are
    // "Ns" / "Nms" etc. We pass milliseconds and convert.
    limiter: Ratelimit.slidingWindow(maxAttempts, `${windowMs} ms`),
    // Prefix all keys so we can tell rate-limit data apart from any
    // other use of the same Upstash DB later.
    prefix: "ch:ratelimit",
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

/**
 * Check whether `key` is within its rate limit. Call BEFORE doing the
 * expensive work; treat `allowed: false` as a 429 response.
 *
 * Defaults match the original in-memory limiter so call sites can swap
 * over without changing their numbers.
 */
export async function rateLimit(
  key: string,
  {
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000, // 15 minutes
  }: { maxAttempts?: number; windowMs?: number } = {}
): Promise<RateLimitResult> {
  const limiter = getLimiter(maxAttempts, windowMs);
  if (!limiter) {
    // Fail open: limiter not configured (dev) or Redis unavailable.
    return { allowed: true, remaining: maxAttempts, resetIn: 0 };
  }
  try {
    const { success, remaining, reset } = await limiter.limit(key);
    return {
      allowed: success,
      remaining,
      // Upstash returns an absolute reset timestamp in ms; convert to a
      // delta so call sites can put it straight into Retry-After or a
      // user-facing "try again in N seconds" message.
      resetIn: Math.max(0, reset - Date.now()),
    };
  } catch (err) {
    // Network blip or Upstash outage — fail open with a loud log so the
    // problem is visible without users being blocked from signing in.
    console.error("[rate-limit] check failed, failing open:", err);
    return { allowed: true, remaining: maxAttempts, resetIn: 0 };
  }
}
