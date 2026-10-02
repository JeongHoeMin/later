import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID, createHash } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@db/client.js';
import { PrismaAppleLoginAttemptRepository } from './prisma-apple-login-attempt.repository.js';
import { PrismaSocialUserRepository } from '@users/infrastructure/persistence/prisma-social-user.repository.js';

describe('PrismaAppleLoginAttemptRepository', () => {
  const now = new Date('2026-10-02T00:00:00Z');
  const nonceHash = createHash('sha256')
    .update('test-only-nonce')
    .digest('hex');
  const ids: string[] = [];
  const userIds: string[] = [];
  let prisma: PrismaClient;
  let repository: PrismaAppleLoginAttemptRepository;
  beforeAll(async () => {
    const loaded = config({ path: '.env.test', quiet: true });
    const url = loaded.parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test')
      throw new Error('통합 테스트는 later_test DB에서 실행해야 합니다.');
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    await prisma.$connect();
    repository = new PrismaAppleLoginAttemptRepository(prisma);
  });
  afterAll(async () => {
    try {
      if (ids.length)
        await prisma.appleLoginAttempt.deleteMany({
          where: { id: { in: ids } },
        });
      if (userIds.length)
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await prisma?.$disconnect();
    }
  });
  async function create(expiresAt = new Date(now.getTime() + 300_000)) {
    const id = randomUUID();
    ids.push(id);
    await repository.create({ id, nonceHash, expiresAt });
    return id;
  }
  it('해시와 만료를 저장하고 시도를 한 번만 소비한다', async () => {
    const id = await create();
    expect(
      await prisma.appleLoginAttempt.findUnique({ where: { id } }),
    ).toMatchObject({ id, nonceHash, usedAt: null });
    expect(await repository.consume(id, nonceHash, now)).toBe(true);
    expect(await repository.consume(id, nonceHash, now)).toBe(false);
    expect(
      (await prisma.appleLoginAttempt.findUniqueOrThrow({ where: { id } }))
        .usedAt,
    ).toEqual(now);
  });
  it('다른 nonce나 존재하지 않는 시도는 소비하지 않는다', async () => {
    const id = await create();
    expect(await repository.consume(id, '0'.repeat(64), now)).toBe(false);
    expect(await repository.consume(randomUUID(), nonceHash, now)).toBe(false);
    expect(await repository.consume(id, nonceHash, now)).toBe(true);
  });
  it('만료 시각과 정확히 같거나 지나면 거부한다', async () => {
    for (const expiresAt of [now, new Date(now.getTime() - 1)]) {
      const id = await create(expiresAt);
      expect(await repository.consume(id, nonceHash, now)).toBe(false);
    }
  });
  it('동시 요청 중 하나만 시도를 소비한다', async () => {
    const id = await create();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => repository.consume(id, nonceHash, now)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it('Apple 계정을 저장하고 같은 subject의 기존 회원을 조회한다', async () => {
    const users = new PrismaSocialUserRepository(prisma);
    const key = { provider: 'apple' as const, subject: randomUUID() };
    const user = await users.createWithSocialAccount(key);
    userIds.push(user.id);
    expect(await users.findBySocialAccount(key)).toEqual(user);
    expect(
      await users.findBySocialAccount({
        provider: 'google',
        subject: key.subject,
      }),
    ).toBeNull();
  });
});
