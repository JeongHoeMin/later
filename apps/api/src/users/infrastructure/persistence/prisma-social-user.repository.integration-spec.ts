import { afterAll, beforeAll, describe, expect, vi } from 'vitest';
import { PrismaSocialUserRepository } from '@users/infrastructure/persistence/prisma-social-user.repository.js';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@db/client.js';
import { SocialAccountAlreadyExistsError } from '@users/domain/errors/social-account-already-exists.error.js';

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

  it('등록된 소셜 계정을 조회하면 연결된 회원을 반환한다.', async () => {
    const key = {
      provider: 'google' as const,
      subject: randomUUID(),
    };

    const savedUser = await prisma.user.create({
      data: {
        socialAccounts: {
          create: key,
        },
      },
      select: {
        id: true,
      },
    });

    try {
      const result = await repository.findBySocialAccount(key);

      expect(result).toEqual({ id: savedUser.id });
    } finally {
      await prisma.user.delete({
        where: { id: savedUser.id },
      });
    }
  });

  it('회원을 생성하면 소셜 계정도 저장되어 해당 회원을 조회할 수 있다.', async () => {
    const key = {
      provider: 'kakao' as const,
      subject: randomUUID(),
    };

    try {
      const createdUser = await repository.createWithSocialAccount(key);

      const savedAccount = await prisma.socialAccount.findUnique({
        where: {
          provider_subject: key,
        },
        include: {
          user: true,
        },
      });

      expect(savedAccount).not.toBeNull();
      expect(savedAccount?.userId).toBe(createdUser.id);
      expect(savedAccount?.user.id).toBe(createdUser.id);

      const foundUser = await repository.findBySocialAccount(key);

      expect(foundUser).toEqual(createdUser);
    } finally {
      await prisma.user.deleteMany({
        where: {
          socialAccounts: {
            some: key,
          },
        },
      });
    }
  });

  it('동일 소셜 계정의 중복 생성이 실패하면 새 회원도 남지 않는다', async () => {
    const key = {
      provider: 'naver' as const,
      subject: randomUUID(),
    };

    const existingUser = await repository.createWithSocialAccount(key);

    try {
      const countBefore = await prisma.user.count();

      await expect(
        repository.createWithSocialAccount(key),
      ).rejects.toBeInstanceOf(SocialAccountAlreadyExistsError);

      expect(await prisma.user.count()).toBe(countBefore);

      expect(await repository.findBySocialAccount(key)).toEqual(existingUser);
    } finally {
      await prisma.user.delete({
        where: { id: existingUser.id },
      });
    }
  });
});
