import type { PrismaClient } from '@db/client.js';
import type {
  AuthCleanupRepository,
  AuthCleanupResult,
} from '../../application/ports/auth-cleanup.repository.js';
export class PrismaAuthCleanupRepository implements AuthCleanupRepository {
  constructor(private readonly client: PrismaClient) {}
  async deleteExpired(
    now: Date,
    batchSize: number,
  ): Promise<AuthCleanupResult> {
    return this.client.$transaction(async (tx) => {
      const apple = await tx.$queryRaw<{ id: string }[]>`
 WITH expired AS (
 SELECT "id" FROM "AppleLoginAttempt" WHERE "expiresAt" <= ${now}
 ORDER BY "expiresAt", "id" LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
 )
 DELETE FROM "AppleLoginAttempt" AS target USING expired
 WHERE target."id" = expired."id" RETURNING target."id"`;
      const naver = await tx.$queryRaw<{ id: string }[]>`
 WITH expired AS (
 SELECT "id" FROM "NaverLoginAttempt" WHERE "expiresAt" <= ${now}
 ORDER BY "expiresAt", "id" LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
 )
 DELETE FROM "NaverLoginAttempt" AS target USING expired
 WHERE target."id" = expired."id" RETURNING target."id"`;
      const sessions = await tx.$queryRaw<{ id: string }[]>`
 WITH expired AS (
 SELECT "id" FROM "AuthSession" WHERE "expiresAt" <= ${now}
 ORDER BY "expiresAt", "id" LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
 )
 DELETE FROM "AuthSession" AS target USING expired
 WHERE target."id" = expired."id" RETURNING target."id"`;
      const buckets = await tx.$queryRaw<{ key: string }[]>`
        WITH expired AS (
          SELECT "key" FROM "AuthRateLimitBucket"
          WHERE "expiresAt" <= LEAST(${now}, statement_timestamp() AT TIME ZONE 'UTC')
          ORDER BY "expiresAt", "key" LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
        )
        DELETE FROM "AuthRateLimitBucket" AS target USING expired
        WHERE target."key" = expired."key" RETURNING target."key"`;
      return {
        appleAttempts: apple.length,
        naverAttempts: naver.length,
        sessions: sessions.length,
        rateLimitBuckets: buckets.length,
      };
    });
  }
}
