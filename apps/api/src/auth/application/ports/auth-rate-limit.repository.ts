export const AUTH_RATE_LIMIT_REPOSITORY = Symbol('AuthRateLimitRepository');
export type RateLimitResult = { allowed: boolean; retryAfter: number };
export interface AuthRateLimitRepository {
  consume(key: string, limit: number): Promise<RateLimitResult>;
}
