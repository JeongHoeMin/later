import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes } from 'node:crypto';
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { PrismaClient, type Prisma } from '@db/client.js';
import { PrismaAuthRateLimitRepository } from './prisma-auth-rate-limit.repository.js';
import { PrismaAuthCleanupRepository } from '../persistence/prisma-auth-cleanup.repository.js';

describe('요청 제한 PostgreSQL 저장소', () => {
  let client: PrismaClient;
  let repository: PrismaAuthRateLimitRepository;
  const keys: string[] = [];
  const key = () => {
    const value = randomBytes(32).toString('hex');
    keys.push(value);
    return value;
  };
  beforeAll(async () => {
    const url = config({ path: '.env.test', quiet: true, override: true })
      .parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test')
      throw new Error('요청 제한 테스트는 later_test만 허용합니다.');
    client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    await client.$connect();
    repository = new PrismaAuthRateLimitRepository(client);
  });
  afterEach(async () => {
    await client.authRateLimitBucket.deleteMany({
      where: { key: { in: keys } },
    });
    keys.length = 0;
  });
  afterAll(async () => {
    await client?.$disconnect();
  });
  it('동시 요청에서 정확히 20회 허용하고 다른 인스턴스도 같은 제한을 사용한다', async () => {
    const id = key();
    const replica = new PrismaAuthRateLimitRepository(client);
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        (i % 2 ? replica : repository).consume(id, 20),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(20);
    expect(results.filter((r) => !r.allowed)).toHaveLength(20);
    for (const result of results)
      expect(result.retryAfter).toBeGreaterThanOrEqual(1);
    expect(
      (
        await client.authRateLimitBucket.findUniqueOrThrow({
          where: { key: id },
        })
      ).hits,
    ).toBe(21);
  });
  it('만료 경계의 기존 카운터는 새 창으로 초기화하고 차단 요청은 만료를 연장하지 않는다', async () => {
    const id = key();
    await client.authRateLimitBucket.create({
      data: { key: id, hits: 99, expiresAt: new Date(0) },
    });
    expect((await repository.consume(id, 2)).allowed).toBe(true);
    const first = await client.authRateLimitBucket.findUniqueOrThrow({
      where: { key: id },
    });
    expect(first.hits).toBe(1);
    expect(first.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(first.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 61000);
    expect((await repository.consume(id, 2)).allowed).toBe(true);
    expect((await repository.consume(id, 2)).allowed).toBe(false);
    const last = await client.authRateLimitBucket.findUniqueOrThrow({
      where: { key: id },
    });
    expect(last.expiresAt).toEqual(first.expiresAt);
    expect(last.hits).toBe(3);
  });
  it('IP와 회원을 위한 서로 다른 키는 독립적으로 소비한다', async () => {
    const a = key(),
      b = key();
    for (let i = 0; i < 10; i++)
      expect((await repository.consume(a, 10)).allowed).toBe(true);
    expect((await repository.consume(a, 10)).allowed).toBe(false);
    expect((await repository.consume(b, 10)).allowed).toBe(true);
  });
  it('기존 정리 주기는 오래된 제한 카운터만 배치로 삭제한다', async () => {
    const minima = await Promise.all([
      client.appleLoginAttempt.aggregate({ _min: { expiresAt: true } }),
      client.naverLoginAttempt.aggregate({ _min: { expiresAt: true } }),
      client.authSession.aggregate({ _min: { expiresAt: true } }),
      client.authRateLimitBucket.aggregate({ _min: { expiresAt: true } }),
    ]);
    const cutoff = new Date(
      Math.min(
        Date.now(),
        ...minima
          .map((m) => m._min.expiresAt?.getTime())
          .filter((v): v is number => v !== undefined),
      ) - 60000,
    );
    const expired = [key(), key(), key()],
      valid = key();
    for (let i = 0; i < 3; i++)
      await client.authRateLimitBucket.create({
        data: {
          key: expired[i]!,
          hits: 1,
          expiresAt: new Date(cutoff.getTime() - 3 + i),
        },
      });
    await client.authRateLimitBucket.create({
      data: { key: valid, hits: 1, expiresAt: new Date(cutoff.getTime() + 1) },
    });
    await new PrismaAuthCleanupRepository(client).deleteExpired(cutoff, 2);
    expect(
      await client.authRateLimitBucket.count({
        where: { key: { in: expired } },
      }),
    ).toBe(1);
    expect(
      await client.authRateLimitBucket.findUnique({ where: { key: valid } }),
    ).not.toBeNull();
    await new PrismaAuthCleanupRepository(client).deleteExpired(cutoff, 2);
    expect(
      await client.authRateLimitBucket.count({
        where: { key: { in: expired } },
      }),
    ).toBe(0);
  });
  it('서버 시각이 앞서도 DB에서 아직 유효한 제한 창은 정리하지 않는다', async () => {
    const id = key();
    await repository.consume(id, 1);
    const rollback = new Error('test transaction rollback');
    // Execute the real cleanup SQL inside a rollback-only transaction so the deliberately future cutoff cannot persist deletion of other tests' rows.
    await expect(
      client.$transaction(async (tx) => {
        const transactionClient = {
          $transaction: <T>(
            action: (connection: Prisma.TransactionClient) => Promise<T>,
          ) => action(tx),
        } as unknown as PrismaClient;
        await new PrismaAuthCleanupRepository(transactionClient).deleteExpired(
          new Date(Date.now() + 86400000),
          500,
        );
        expect(
          await tx.authRateLimitBucket.findUnique({ where: { key: id } }),
        ).not.toBeNull();
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect((await repository.consume(id, 1)).allowed).toBe(false);
  });
});
