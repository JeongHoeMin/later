import type { AuthRateLimitRepository } from '../../src/auth/application/ports/auth-rate-limit.repository.js';
// The only substituted boundary is the external rate-limit store. Guards, policy selection and HTTP responses remain real.
export class TestAuthRateLimitRepository implements AuthRateLimitRepository {
  readonly buckets = new Map<string, { hits: number; expiresAt: number }>();
  constructor(private readonly now: () => number = Date.now) {}
  async consume(key: string, limit: number) {
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      bucket = { hits: 0, expiresAt: now + 60000 };
      this.buckets.set(key, bucket);
    }
    bucket.hits = Math.min(bucket.hits + 1, limit + 1);
    return {
      allowed: bucket.hits <= limit,
      retryAfter: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
    };
  }
}
