import { afterAll, beforeAll, describe, expect } from 'vitest';
import { PrismaSocialUserRepository } from '@users/infrastructure/persistence/prisma-social-user.repository.js';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@db/client.js';

describe('PrismaSocialUserRepository', () => {
  let prisma: PrismaClient;
  let repository: PrismaSocialUserRepository;

  beforeAll(async () => {
    const loaded = config({ path: '.env.test', override: true });

    if (loaded.error) {
      throw loaded.error;
    }

    const url = loaded.parsed?.DATABASE_URL;

    if (!url) {
      throw new Error('.env.test에 DATABASE_URL이 필요합니다.');
    }

    if (new URL(url).pathname !== '/later_test') {
      throw new Error('통합 테스트는 later_test DB에서 실행해야 합니다.');
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });

    await prisma.$connect();

    await prisma.socialAccount.count();

    repository = new PrismaSocialUserRepository(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('등록되지 않은 소셜 계정을 조회하면 null을 반환한다.', async () => {
    const result = await repository.findBySocialAccount({
      provider: 'google',
      subject: randomUUID(),
    });

    expect(result).toBeNull();
  });
});
