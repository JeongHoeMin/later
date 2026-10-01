import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@db/client.js';
import { FindOrCreateSocialUserUseCase } from '@users/application/find-or-create-social-user.use-case.js';
import { SOCIAL_USER_REPOSITORY } from '@users/application/ports/social-user.repository.js';
import { UsersModule } from './users.module.js';

describe('UsersModule', () => {
  it('외부 모듈에 회원 유스케이스를 제공하고 교체한 저장소로 실행한다', async () => {
    const user = { id: 'existing-user' };
    const repository = {
      findBySocialAccount: vi.fn().mockResolvedValue(user),
      createWithSocialAccount: vi.fn(),
    };
    const client = {
      $connect: async () => {},
      $disconnect: async () => {},
    };
    const consumer = Symbol('AuthConsumer');
    const module = await Test.createTestingModule({
      imports: [UsersModule],
      providers: [
        {
          provide: consumer,
          inject: [FindOrCreateSocialUserUseCase],
          useFactory: (useCase: FindOrCreateSocialUserUseCase) => useCase,
        },
      ],
    })
      .overrideProvider(PrismaClient)
      .useValue(client)
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(repository)
      .compile();

    try {
      await module.init();
      const useCase = module.get<FindOrCreateSocialUserUseCase>(consumer);

      expect(
        await useCase.execute({ provider: 'google', subject: 'social-user' }),
      ).toEqual(user);
    } finally {
      await module.close();
    }
  });
});
