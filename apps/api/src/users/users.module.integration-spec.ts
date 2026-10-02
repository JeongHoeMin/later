import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@db/client.js';
import { FindOrCreateSocialUserUseCase } from '@users/application/find-or-create-social-user.use-case.js';
import { UsersModule } from './users.module.js';

describe('UsersModule integration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('주입된 유스케이스로 회원을 저장하고 동일 계정의 기존 회원을 반환한다', async () => {
    const loaded = config({ path: '.env.test', quiet: true });
    if (loaded.error) throw loaded.error;
    const url = loaded.parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test') {
      throw new Error('통합 테스트는 later_test DB에서 실행해야 합니다.');
    }
    vi.stubEnv('DATABASE_URL', url);

    const key = { provider: 'google' as const, subject: randomUUID() };
    let module: TestingModule | undefined;
    let client: PrismaClient | undefined;

    try {
      module = await Test.createTestingModule({
        imports: [UsersModule],
      }).compile();
      client = module.get<PrismaClient>(PrismaClient);
      await module.init();
      const useCase = module.get(FindOrCreateSocialUserUseCase);

      const created = await useCase.execute(key);
      const existing = await useCase.execute(key);
      const account = await client.socialAccount.findUnique({
        where: { provider_subject: key },
        select: { userId: true },
      });

      expect(existing).toEqual(created);
      expect(account?.userId).toBe(created.id);
      expect(await client.socialAccount.count({ where: key })).toBe(1);
    } finally {
      try {
        await client?.user.deleteMany({
          where: { socialAccounts: { some: key } },
        });
      } finally {
        await module?.close();
      }
    }
  });
});
