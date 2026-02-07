import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_REQUESTS_PER_SECOND = 10;

export const resolveOpenRouterRateLimit = (
  raw: string | undefined
): number | null => {
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_REQUESTS_PER_SECOND;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REQUESTS_PER_SECOND;
  }
  if (parsed <= 0) {
    return null;
  }
  return parsed;
};

export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private tokens: number;
  private lastRefillAt: number;

  constructor(requestsPerSecond: number, burst: number = requestsPerSecond) {
    if (!Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0) {
      throw new Error("requestsPerSecond must be positive");
    }
    const normalizedBurst = Math.max(1, Math.floor(burst));
    this.capacity = normalizedBurst;
    this.refillPerMs = requestsPerSecond / 1000;
    this.tokens = normalizedBurst;
    this.lastRefillAt = Date.now();
  }

  async take(signal?: AbortSignal): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      const missing = 1 - this.tokens;
      const waitMs = Math.max(1, Math.ceil(missing / this.refillPerMs));
      await delay(waitMs, undefined, signal ? { signal } : undefined);
    }
  }

  private refill(): void {
    const now = Date.now();
    if (now <= this.lastRefillAt) {
      return;
    }

    const elapsedMs = now - this.lastRefillAt;
    this.lastRefillAt = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedMs * this.refillPerMs);
  }
}

let sharedLimiter: TokenBucketRateLimiter | null | undefined;

const resolveSharedLimiter = (): TokenBucketRateLimiter | null => {
  if (sharedLimiter !== undefined) {
    return sharedLimiter;
  }

  const requestsPerSecond = resolveOpenRouterRateLimit(process.env.OPENROUTER_RATE_LIMIT);
  if (requestsPerSecond === null) {
    sharedLimiter = null;
    return sharedLimiter;
  }

  sharedLimiter = new TokenBucketRateLimiter(requestsPerSecond);
  return sharedLimiter;
};

export const waitForOpenRouterToken = async (signal?: AbortSignal): Promise<void> => {
  const limiter = resolveSharedLimiter();
  if (!limiter) {
    return;
  }
  await limiter.take(signal);
};

export const resetOpenRouterRateLimiterForTests = (): void => {
  sharedLimiter = undefined;
};
