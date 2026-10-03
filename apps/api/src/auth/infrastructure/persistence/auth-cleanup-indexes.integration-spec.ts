import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@db/client.js';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

describe('인증 정리·연동 조회 인덱스', () => {
  let prisma: PrismaClient;
  beforeAll(async () => {
    const loaded = config({ path: '.env.test', quiet: true, override: true });
    const url = loaded.parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test')
      throw new Error('인덱스 검증은 later_test에서만 실행합니다.');
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });
  it('만료 세션과 owner FK의 유효한 인덱스가 존재한다', async () => {
    const indexes = await prisma.$queryRaw<
      { name: string; valid: boolean; definition: string }[]
    >`
      SELECT c.relname AS name, i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS definition
      FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN (
        'AuthSession_expiresAt_id_idx', 'AppleLoginAttempt_ownerUserId_idx', 'NaverLoginAttempt_ownerUserId_idx'
      )`;
    expect(indexes).toHaveLength(3);
    expect(indexes.every((index) => index.valid)).toBe(true);
    expect(
      indexes.find((i) => i.name === 'AuthSession_expiresAt_id_idx')
        ?.definition,
    ).toContain('("expiresAt", id)');
    for (const table of ['AppleLoginAttempt', 'NaverLoginAttempt'])
      expect(
        indexes.find((i) => i.name === `${table}_ownerUserId_idx`)?.definition,
      ).toContain('("ownerUserId")');
  });
  it('실제 정리·owner 조회에 새 인덱스를 사용하는 실행 계획을 만들 수 있다', async () => {
    await prisma.$transaction(async (tx) => {
      // Tiny test tables naturally favor sequential scans. This proves query/index compatibility, not production speed.
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      const sessions = await tx.$queryRaw`
        EXPLAIN (FORMAT JSON) SELECT "id" FROM "AuthSession"
        WHERE "expiresAt" <= ${new Date()}
        ORDER BY "expiresAt", "id" LIMIT 500 FOR UPDATE SKIP LOCKED`;
      expect(JSON.stringify(sessions)).toContain(
        'AuthSession_expiresAt_id_idx',
      );
      const owner = randomUUID();
      const apple = await tx.$queryRaw`
        EXPLAIN (FORMAT JSON) SELECT "id" FROM "AppleLoginAttempt" WHERE "ownerUserId" = ${owner}::uuid`;
      const naver = await tx.$queryRaw`
        EXPLAIN (FORMAT JSON) SELECT "id" FROM "NaverLoginAttempt" WHERE "ownerUserId" = ${owner}::uuid`;
      expect(JSON.stringify(apple)).toContain(
        'AppleLoginAttempt_ownerUserId_idx',
      );
      expect(JSON.stringify(naver)).toContain(
        'NaverLoginAttempt_ownerUserId_idx',
      );
    });
  });
});
