// Simple in-memory rate limiter (resets on server restart)
// For production with multiple instances, use Redis instead

const attempts = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts) {
    if (value.resetAt < now) {
      attempts.delete(key);
    }
  }
}, 60_000); // every minute

export function rateLimit(
  key: string,
  {
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000, // 15 minutes
  }: { maxAttempts?: number; windowMs?: number } = {}
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, resetIn: windowMs };
  }

  entry.count++;

  if (entry.count > maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetIn: entry.resetAt - now,
  };
}
