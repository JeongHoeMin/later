import type { PrismaClient } from '@db/client.js';
import type {
  AuthRateLimitRepository,
  RateLimitResult,
} from '../../application/ports/auth-rate-limit.repository.js';

export class PrismaAuthRateLimitRepository implements AuthRateLimitRepository {
  constructor(private readonly client: PrismaClient) {}

  async consume(key: string, limit: number): Promise<RateLimitResult> {
    const [result] = await this.client.$queryRaw<
      { hits: number; retryAfter: number }[]
    >`
      INSERT INTO "AuthRateLimitBucket" ("key", "hits", "expiresAt")
      VALUES (${key}, 1, (statement_timestamp() AT TIME ZONE 'UTC') + interval '60 seconds')
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "AuthRateLimitBucket"."expiresAt" <= (statement_timestamp() AT TIME ZONE 'UTC')
          THEN 1 ELSE LEAST("AuthRateLimitBucket"."hits" + 1, ${limit + 1}) END,
        "expiresAt" = CASE WHEN "AuthRateLimitBucket"."expiresAt" <= (statement_timestamp() AT TIME ZONE 'UTC')
          THEN (statement_timestamp() AT TIME ZONE 'UTC') + interval '60 seconds'
          ELSE "AuthRateLimitBucket"."expiresAt" END
      RETURNING "hits", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - (statement_timestamp() AT TIME ZONE 'UTC')))))::integer AS "retryAfter"
    `;
    if (!result) throw new Error('요청 제한 집계에 실패했습니다.');
    return { allowed: result.hits <= limit, retryAfter: result.retryAfter };
  }
}
