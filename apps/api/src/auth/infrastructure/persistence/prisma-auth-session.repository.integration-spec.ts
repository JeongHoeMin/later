import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID, createHash } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@db/client.js';
import { PrismaAuthSessionRepository } from './prisma-auth-session.repository.js';
describe('PrismaAuthSessionRepository', () => {
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
});
