import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
} from 'vitest';
import { PrismaClient } from '@db/client.js';
import { CleanupExpiredAuthUseCase } from '../../application/cleanup-expired-auth.use-case.js';
import { PrismaAuthCleanupRepository } from './prisma-auth-cleanup.repository.js';
import { PrismaAuthSessionRepository } from './prisma-auth-session.repository.js';

describe('인증 만료 데이터 실제 DB 정리', () => {
  let prisma: PrismaClient;
  let repository: PrismaAuthCleanupRepository;
  let userId: string;
  let now: Date;
  const appleIds: string[] = [];
  const naverIds: string[] = [];
  beforeAll(async () => {
    const loaded = config({ path: '.env.test', quiet: true, override: true });
    const url = loaded.parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test')
      throw new Error('정리 테스트는 later_test DB에서만 실행해야 합니다.');
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    await prisma.$connect();
    repository = new PrismaAuthCleanupRepository(prisma);
  });
  beforeEach(async () => {
    // Put the test cutoff BEFORE every pre-existing row so cleanup never deletes data owned by other tests.
    const minima = await Promise.all([
      prisma.appleLoginAttempt.aggregate({ _min: { expiresAt: true } }),
      prisma.naverLoginAttempt.aggregate({ _min: { expiresAt: true } }),
      prisma.authSession.aggregate({ _min: { expiresAt: true } }),
      prisma.authRateLimitBucket.aggregate({ _min: { expiresAt: true } }),
    ]);
    const values = minima
      .map((m) => m._min.expiresAt?.getTime())
      .filter((value): value is number => value !== undefined);
    now = new Date(Math.min(Date.now(), ...values) - 60000);
    userId = (await prisma.user.create({ data: {} })).id;
  });
  afterEach(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (appleIds.length)
      await prisma.appleLoginAttempt.deleteMany({
        where: { id: { in: appleIds } },
      });
    if (naverIds.length)
      await prisma.naverLoginAttempt.deleteMany({
        where: { id: { in: naverIds } },
      });
    appleIds.length = 0;
    naverIds.length = 0;
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });
  const time = (offset: number) => new Date(now.getTime() + offset);
  async function apple(expiresAt: Date, used = false, link = false) {
    const id = randomUUID();
    appleIds.push(id);
    await prisma.appleLoginAttempt.create({
      data: {
        id,
        nonceHash: 'a'.repeat(64),
        expiresAt,
        usedAt: used ? time(-1) : null,
        ownerUserId: link ? userId : null,
      },
    });
    return id;
  }
  async function naver(expiresAt: Date, used = false, link = false) {
    const id = randomUUID();
    naverIds.push(id);
    await prisma.naverLoginAttempt.create({
      data: {
        id,
        stateHash: randomUUID().padEnd(64, '0'),
        secretHash: 's'.repeat(64),
        expiresAt,
        usedAt: used ? time(-1) : null,
        sealedGrant: used ? null : 'test-only-sealed',
        ownerUserId: link ? userId : null,
      },
    });
    return id;
  }
  async function session(expiresAt: Date, revoked = false) {
    return prisma.authSession.create({
      data: {
        userId,
        expiresAt,
        revokedAt: revoked ? time(-1) : null,
        refreshTokens: {
          create: [
            { hash: randomUUID().padEnd(64, '0') },
            { hash: randomUUID().padEnd(64, '0'), usedAt: time(-1) },
          ],
        },
      },
      include: { refreshTokens: true },
    });
  }
  async function expiredAppleBatch() {
    const ids = Array.from({ length: 501 }, () => randomUUID());
    appleIds.push(...ids);
    await prisma.appleLoginAttempt.createMany({
      data: ids.map((id) => ({
        id,
        nonceHash: 'a'.repeat(64),
        expiresAt: time(-1),
      })),
    });
    return ids;
  }
  it('실제 DB에서500개를 넘는 만료 행을 여러 배치로 정리한다', async () => {
    const ids = await expiredAppleBatch();
    const valid = await apple(time(1));
    const result = await new CleanupExpiredAuthUseCase(
      repository,
      () => now,
    ).execute();
    expect(result).toEqual({
      appleAttempts: 501,
      naverAttempts: 0,
      sessions: 0,
      rateLimitBuckets: 0,
      batches: 2,
      limitReached: false,
    });
    expect(
      await prisma.appleLoginAttempt.count({ where: { id: { in: ids } } }),
    ).toBe(0);
    expect(
      await prisma.appleLoginAttempt.findUnique({ where: { id: valid } }),
    ).not.toBeNull();
  });
  it('다음 배치가 실패해도 이전 성공 배치는 유지하고 다음 실행에서 잔여를 처리한다', async () => {
    const ids = await expiredAppleBatch();
    let calls = 0;
    const failing = {
      deleteExpired: async (cutoff: Date, size: number) => {
        if (++calls === 2) throw new Error('test-only-next-batch-error');
        return repository.deleteExpired(cutoff, size);
      },
    };
    await expect(
      new CleanupExpiredAuthUseCase(failing, () => now).execute(),
    ).rejects.toThrow('test-only-next-batch-error');
    expect(
      await prisma.appleLoginAttempt.count({ where: { id: { in: ids } } }),
    ).toBe(1);
    expect(
      (await new CleanupExpiredAuthUseCase(repository, () => now).execute())
        .appleAttempts,
    ).toBe(1);
  });
  it('만료 시각과 같거나 지난 로그인·연동 시도 및 세션만 삭제한다', async () => {
    const expiredApple = [await apple(time(-1)), await apple(now, true, true)];
    const expiredNaver = [await naver(time(-1)), await naver(now, true, true)];
    const validApple = await apple(time(1), true, true);
    const validNaver = await naver(time(1), true, true);
    const expired = [await session(time(-1)), await session(now, true)];
    const valid = await session(time(1), true);
    const social = await prisma.socialAccount.create({
      data: { userId, provider: 'google', subject: randomUUID() },
    });
    expect(await repository.deleteExpired(now, 500)).toEqual({
      appleAttempts: 2,
      naverAttempts: 2,
      sessions: 2,
      rateLimitBuckets: 0,
    });
    expect(
      await prisma.appleLoginAttempt.count({
        where: { id: { in: expiredApple } },
      }),
    ).toBe(0);
    expect(
      await prisma.naverLoginAttempt.count({
        where: { id: { in: expiredNaver } },
      }),
    ).toBe(0);
    expect(
      await prisma.appleLoginAttempt.findUnique({ where: { id: validApple } }),
    ).not.toBeNull();
    expect(
      await prisma.naverLoginAttempt.findUnique({ where: { id: validNaver } }),
    ).not.toBeNull();
    expect(
      await prisma.refreshToken.count({
        where: { sessionId: { in: expired.map((s) => s.id) } },
      }),
    ).toBe(0);
    expect(
      await prisma.refreshToken.count({ where: { sessionId: valid.id } }),
    ).toBe(2);
    expect(
      await prisma.user.findUnique({ where: { id: userId } }),
    ).not.toBeNull();
    expect(
      await prisma.socialAccount.findUnique({ where: { id: social.id } }),
    ).not.toBeNull();
    expect(await repository.deleteExpired(now, 500)).toEqual({
      appleAttempts: 0,
      naverAttempts: 0,
      sessions: 0,
      rateLimitBuckets: 0,
    });
  });
  it('테이블별 배치 제한으로 가장 오래된 행부터 정리한다', async () => {
    const oldApple = [await apple(time(-3)), await apple(time(-2))];
    const lastApple = await apple(time(-1));
    const oldNaver = [await naver(time(-3)), await naver(time(-2))];
    const lastNaver = await naver(time(-1));
    const oldSessions = [await session(time(-3)), await session(time(-2))];
    const lastSession = await session(time(-1));
    expect(await repository.deleteExpired(now, 2)).toEqual({
      appleAttempts: 2,
      naverAttempts: 2,
      sessions: 2,
      rateLimitBuckets: 0,
    });
    expect(
      await prisma.appleLoginAttempt.count({ where: { id: { in: oldApple } } }),
    ).toBe(0);
    expect(
      await prisma.appleLoginAttempt.findUnique({ where: { id: lastApple } }),
    ).not.toBeNull();
    expect(
      await prisma.naverLoginAttempt.count({ where: { id: { in: oldNaver } } }),
    ).toBe(0);
    expect(
      await prisma.naverLoginAttempt.findUnique({ where: { id: lastNaver } }),
    ).not.toBeNull();
    expect(
      await prisma.authSession.count({
        where: { id: { in: oldSessions.map((s) => s.id) } },
      }),
    ).toBe(0);
    expect(
      await prisma.authSession.findUnique({ where: { id: lastSession.id } }),
    ).not.toBeNull();
    expect(await repository.deleteExpired(now, 2)).toEqual({
      appleAttempts: 1,
      naverAttempts: 1,
      sessions: 1,
      rateLimitBuckets: 0,
    });
  });
  it('여러 서버의 동시 정리는 중복 집계 없이 만료 데이터만 삭제한다', async () => {
    for (let i = 0; i < 5; i++) {
      await apple(time(-1));
      await naver(time(-1));
      await session(time(-1));
    }
    const results = await Promise.all([
      repository.deleteExpired(now, 500),
      repository.deleteExpired(now, 500),
    ]);
    for (const key of ['appleAttempts', 'naverAttempts', 'sessions'] as const)
      expect(results.reduce((count, r) => count + r[key], 0)).toBe(5);
    expect(await repository.deleteExpired(now, 500)).toEqual({
      appleAttempts: 0,
      naverAttempts: 0,
      sessions: 0,
      rateLimitBuckets: 0,
    });
  });
  it('다른 트랜잭션이 잠근 시도는 기다리지 않고 다음 실행까지 보존한다', async () => {
    const locked = await apple(time(-2));
    const other = await apple(time(-1));
    let release!: () => void;
    let ready!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const transaction = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AppleLoginAttempt" WHERE "id" = ${locked}::uuid FOR UPDATE`;
      ready();
      await held;
    });
    try {
      await acquired;
      expect(await repository.deleteExpired(now, 500)).toEqual({
        appleAttempts: 1,
        naverAttempts: 0,
        sessions: 0,
        rateLimitBuckets: 0,
      });
      expect(
        await prisma.appleLoginAttempt.findUnique({ where: { id: locked } }),
      ).not.toBeNull();
      expect(
        await prisma.appleLoginAttempt.findUnique({ where: { id: other } }),
      ).toBeNull();
    } finally {
      release();
      await transaction;
    }
    expect((await repository.deleteExpired(now, 500)).appleAttempts).toBe(1);
  });
  it('유효한 세션의 사용 완료 토큰을 보존해 재사용 탐지가 유지된다', async () => {
    const value = await session(time(1));
    const original = value.refreshTokens.find((t) => t.usedAt !== null)!;
    const current = value.refreshTokens.find((t) => t.usedAt === null)!;
    await repository.deleteExpired(now, 500);
    const sessions = new PrismaAuthSessionRepository(prisma);
    expect(
      await sessions.rotate(original.hash, randomUUID().padEnd(64, '0'), now),
    ).toBe('reused');
    expect(
      await sessions.rotate(current.hash, randomUUID().padEnd(64, '0'), now),
    ).toBe('invalid');
    await repository.deleteExpired(now, 500);
    expect(
      await prisma.refreshToken.count({ where: { sessionId: value.id } }),
    ).toBe(2);
  });
});
