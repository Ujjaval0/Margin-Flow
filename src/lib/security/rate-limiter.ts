/**
 * MarginFlow — Process-local Token-Bucket Rate Limiter
 * Provides supplemental per-process rate limiting for Amazon SP-API,
 * marketplace connectors, and public ingress APIs to prevent 429 throttling
 * and server resource exhaustion. Shared multi-instance quotas remain a release requirement.
 */

if (typeof window !== "undefined") {
  throw new Error("FATAL: rate-limiter.ts cannot be executed in client bundles.");
}

interface BucketState {
  tokens: number;
  lastRefillTimeMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  retryAfterSeconds: number;
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, BucketState>();
  private readonly capacity: number;
  private readonly refillRatePerSec: number;
  private readonly cleanupIntervalMs: number;

  constructor(options: {
    capacity: number;
    refillRatePerSec: number;
    cleanupIntervalMs?: number;
  }) {
    this.capacity = Math.max(1, options.capacity);
    this.refillRatePerSec = Math.max(0.1, options.refillRatePerSec);
    this.cleanupIntervalMs = options.cleanupIntervalMs || 60_000;

    // Periodically prune stale buckets
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => this.pruneStaleBuckets(), this.cleanupIntervalMs);
      if (timer.unref) timer.unref();
    }
  }

  /**
   * Consumes `tokens` from the bucket for `key`.
   */
  public consume(key: string, tokens = 1): RateLimitResult {
    const now = Date.now();
    let state = this.buckets.get(key);

    if (!state) {
      state = {
        tokens: this.capacity,
        lastRefillTimeMs: now,
      };
      this.buckets.set(key, state);
    } else {
      // Calculate refilled tokens based on elapsed time
      const elapsedSeconds = (now - state.lastRefillTimeMs) / 1000;
      const refilledTokens = elapsedSeconds * this.refillRatePerSec;
      state.tokens = Math.min(this.capacity, state.tokens + refilledTokens);
      state.lastRefillTimeMs = now;
    }

    if (state.tokens >= tokens) {
      state.tokens -= tokens;
      return {
        allowed: true,
        remainingTokens: Math.floor(state.tokens),
        retryAfterSeconds: 0,
      };
    } else {
      const deficit = tokens - state.tokens;
      const retryAfterSeconds = Math.ceil(deficit / this.refillRatePerSec);
      return {
        allowed: false,
        remainingTokens: 0,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    }
  }

  /**
   * Removes idle buckets to prevent memory accumulation.
   */
  private pruneStaleBuckets(): void {
    const now = Date.now();
    const staleThresholdMs = (this.capacity / this.refillRatePerSec) * 2000;

    for (const [key, state] of this.buckets.entries()) {
      if (now - state.lastRefillTimeMs > staleThresholdMs) {
        this.buckets.delete(key);
      }
    }
  }
}

// Preset rate limiters:
// 1. Amazon SP-API Orders connector: Burst 5, 1 req/sec refill (strictly respects Amazon SP-API quota)
export const amazonSpApiLimiter = new TokenBucketRateLimiter({
  capacity: 5,
  refillRatePerSec: 1,
});

// 2. Marketplace Sync endpoints: Burst 10, 2 req/sec refill
export const marketplaceSyncLimiter = new TokenBucketRateLimiter({
  capacity: 10,
  refillRatePerSec: 2,
});

// 3. Webhook Ingestion: Burst 100, 20 req/sec refill
export const webhookIngestionLimiter = new TokenBucketRateLimiter({
  capacity: 100,
  refillRatePerSec: 20,
});
