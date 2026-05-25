/**
 * Rate limiting via Upstash Redis.
 * Falls back to a no-op if env vars are not set (useful for local dev / CI).
 */

let ratelimiter: {
  limit: (key: string) => Promise<{ success: boolean; remaining: number }>;
} | null = null;

async function getRatelimiter() {
  if (ratelimiter) return ratelimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    ratelimiter = {
      limit: async () => ({ success: true, remaining: 99 }),
    };
    return ratelimiter;
  }

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  const redis = new Redis({ url, token });
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "fiat402:facilitate",
  });

  ratelimiter = {
    limit: (key: string) => rl.limit(key),
  };
  return ratelimiter;
}

export async function checkRateLimit(orgId: string) {
  const rl = await getRatelimiter();
  return rl.limit(orgId);
}
