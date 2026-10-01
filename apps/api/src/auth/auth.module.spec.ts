import { Test } from '@nestjs/testing';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthModule } from './auth.module.js';
import { PrismaClient } from '@db/client.js';
import { SOCIAL_USER_REPOSITORY } from '@users/application/ports/social-user.repository.js';
import { SocialLoginUseCase } from '@auth/application/social-login.use-case.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';

const clientId = 'our-client.apps.googleusercontent.com';

function builder() {
  return Test.createTestingModule({ imports: [AuthModule] })
    .overrideProvider(PrismaClient)
    .useValue({ $connect: async () => {}, $disconnect: async () => {} });
}

describe('AuthModule', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, '', '   '])(
    'Client ID %j가 없으면 모듈 구성을 거부한다',
    async (value) => {
      vi.stubEnv('GOOGLE_CLIENT_ID', value);
      await expect(builder().compile()).rejects.toThrow('GOOGLE_CLIENT_ID');
    },
  );

  it('외부 소비자에게 로그인 유스케이스를 제공하고 구글 인증 후 회원을 연결한다', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', clientId);
    const user = { id: 'existing-user' };
    const repository = {
      findBySocialAccount: vi.fn().mockResolvedValue(user),
      createWithSocialAccount: vi.fn(),
    };
    const client = {
      verifyIdToken: vi.fn().mockResolvedValue(
        new LoginTicket('header', {
          iss: 'https://accounts.google.com',
          aud: clientId,
          sub: 'verified-google-subject',
          iat: 1,
          exp: 2,
        }),
      ),
    };
    const consumer = Symbol('LoginConsumer');
    const module = await Test.createTestingModule({
      imports: [AuthModule],
      providers: [
        {
          provide: consumer,
          inject: [SocialLoginUseCase],
          useFactory: (useCase: SocialLoginUseCase) => useCase,
        },
      ],
    })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(repository)
      .overrideProvider(OAuth2Client)
      .useValue(client)
      .compile();

    try {
      const login = module.get<SocialLoginUseCase>(consumer);
      await expect(
        login.execute({ provider: 'google', credential: 'id-token' }),
      ).resolves.toEqual(user);
      expect(client.verifyIdToken).toHaveBeenCalledExactlyOnceWith({
        idToken: 'id-token',
        audience: clientId,
      });
      expect(repository.findBySocialAccount).toHaveBeenCalledExactlyOnceWith({
        provider: 'google',
        subject: 'verified-google-subject',
      });
      expect(repository.createWithSocialAccount).not.toHaveBeenCalled();
    } finally {
      await module.close();
    }
  });

  it('구글 인증 실패 시 회원 저장소에 접근하지 않는다', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', clientId);
    const repository = {
      findBySocialAccount: vi.fn(),
      createWithSocialAccount: vi.fn(),
    };
    const module = await builder()
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(repository)
      .overrideProvider(OAuth2Client)
      .useValue({
        verifyIdToken: vi.fn().mockRejectedValue(new Error('invalid token')),
      })
      .compile();
    try {
      await expect(
        module
          .get(SocialLoginUseCase)
          .execute({ provider: 'google', credential: 'invalid-token' }),
      ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
      expect(repository.findBySocialAccount).not.toHaveBeenCalled();
      expect(repository.createWithSocialAccount).not.toHaveBeenCalled();
    } finally {
      await module.close();
    }
  });
});
