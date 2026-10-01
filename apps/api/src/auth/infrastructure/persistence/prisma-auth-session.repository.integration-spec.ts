import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID, createHash } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@db/client.js';
import { PrismaAuthSessionRepository } from './prisma-auth-session.repository.js';
describe('PrismaAuthSessionRepository', () => {
  const now = new Date('2026-10-02T00:00:00Z');
  const hash = () => createHash('sha256').update(randomUUID()).digest('hex');
  let prisma: PrismaClient;
  let userId: string;
  let repository: PrismaAuthSessionRepository;
  beforeAll(async () => {
    const loaded = config({ path: '.env.test', quiet: true });
    const url = loaded.parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test')
      throw new Error('통합 테스트는 later_test DB에서 실행해야 합니다.');
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    await prisma.$connect();
    userId = (await prisma.user.create({ data: {} })).id;
    repository = new PrismaAuthSessionRepository(prisma);
  });
  afterAll(async () => {
    try {
      if (userId) await prisma.user.delete({ where: { id: userId } });
    } finally {
      await prisma?.$disconnect();
    }
  });
  it('세션과 토큰 해시를 관계로 저장한다', async () => {
    const tokenHash = createHash('sha256').update(randomUUID()).digest('hex');
    const expiresAt = new Date('2026-11-01T00:00:00Z');
    await repository.create({ userId, tokenHash, expiresAt });
    const stored = await prisma.refreshToken.findUnique({
      where: { hash: tokenHash },
      include: { session: true },
    });
    expect(stored).toMatchObject({
      hash: tokenHash,
      usedAt: null,
      session: { userId, expiresAt, revokedAt: null },
    });
  });
  it('같은 해시의 토큰 생성이 실패하면 새 세션도 남지 않는다', async () => {
    const tokenHash = createHash('sha256').update(randomUUID()).digest('hex');
    const session = {
      userId,
      tokenHash,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    };
    await repository.create(session);
    const before = await prisma.authSession.count({ where: { userId } });
    await expect(repository.create(session)).rejects.toThrow();
    expect(await prisma.authSession.count({ where: { userId } })).toBe(before);
    expect(
      await prisma.refreshToken.count({ where: { hash: tokenHash } }),
    ).toBe(1);
  });

  it('기존 토큰을 소비하고 같은 세션에 새 해시를 저장한다', async () => {
    const original = hash();
    const next = hash();
    const expiresAt = new Date('2026-11-01T00:00:00Z');
    await repository.create({ userId, tokenHash: original, expiresAt });
    expect(await repository.findUserId(original)).toBe(userId);
    expect(await repository.rotate(original, next, now)).toBe('rotated');
    const old = await prisma.refreshToken.findUniqueOrThrow({
      where: { hash: original },
    });
    const fresh = await prisma.refreshToken.findUniqueOrThrow({
      where: { hash: next },
      include: { session: true },
    });
    expect(old.usedAt).toEqual(now);
    expect(fresh.sessionId).toBe(old.sessionId);
    expect(fresh.session.expiresAt).toEqual(expiresAt);
    expect(fresh.usedAt).toBeNull();
  });

  it('소비한 토큰 재사용은 세션을 폐기하고 새 토큰도 무효화한다', async () => {
    const original = hash();
    const next = hash();
    await repository.create({
      userId,
      tokenHash: original,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    });
    await repository.rotate(original, next, now);
    expect(await repository.rotate(original, hash(), now)).toBe('reused');
    const stored = await prisma.refreshToken.findUniqueOrThrow({
      where: { hash: next },
      include: { session: true },
    });
    expect(stored.session.revokedAt).toEqual(now);
    expect(await repository.rotate(next, hash(), now)).toBe('invalid');
  });

  it('만료 시점에 도달한 세션은 갱신하지 않는다', async () => {
    const original = hash();
    const next = hash();
    await repository.create({ userId, tokenHash: original, expiresAt: now });
    expect(await repository.rotate(original, next, now)).toBe('invalid');
    expect(
      await prisma.refreshToken.findUnique({ where: { hash: next } }),
    ).toBeNull();
  });

  it('같은 토큰의 동시 갱신은 한 번만 성공하고 재사용으로 세션을 폐기한다', async () => {
    const original = hash();
    await repository.create({
      userId,
      tokenHash: original,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    });
    const results = await Promise.all([
      repository.rotate(original, hash(), now),
      repository.rotate(original, hash(), now),
    ]);
    expect(results.sort()).toEqual(['reused', 'rotated']);
    const stored = await prisma.refreshToken.findUniqueOrThrow({
      where: { hash: original },
      include: { session: { include: { refreshTokens: true } } },
    });
    expect(stored.session.revokedAt).toEqual(now);
    expect(stored.session.refreshTokens).toHaveLength(2);
  });

  it('새 해시 저장 실패 시 기존 토큰의 소비도 롤백한다', async () => {
    const original = hash();
    await repository.create({
      userId,
      tokenHash: original,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    });
    await expect(repository.rotate(original, original, now)).rejects.toThrow();
    expect(
      (
        await prisma.refreshToken.findUniqueOrThrow({
          where: { hash: original },
        })
      ).usedAt,
    ).toBeNull();
    expect(await repository.rotate(original, hash(), now)).toBe('rotated');
  });

  it('로그아웃은 해당 세션만 폐기하며 반복 호출해도 성공한다', async () => {
    const original = hash();
    const other = hash();
    await repository.create({
      userId,
      tokenHash: original,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    });
    await repository.create({
      userId,
      tokenHash: other,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    });
    await repository.revokeByHash(original, now);
    await repository.revokeByHash(original, now);
    expect(await repository.rotate(original, hash(), now)).toBe('invalid');
    expect(await repository.rotate(other, hash(), now)).toBe('rotated');
  });

  it('존재하지 않는 해시는 갱신할 수 없고 로그아웃은 반복 가능한 무동작이다', async () => {
    const unknown = hash();
    expect(await repository.findUserId(unknown)).toBeNull();
    expect(await repository.rotate(unknown, hash(), now)).toBe('invalid');
    await expect(
      repository.revokeByHash(unknown, now),
    ).resolves.toBeUndefined();
  });
});
