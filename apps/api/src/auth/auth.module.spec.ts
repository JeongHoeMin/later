import { Test } from '@nestjs/testing';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('NAVER_CLIENT_ID', 'our-naver-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'our-naver-secret');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-only-access-secret-with-at-least-32-bytes',
    );
  });

  it('Apple 앱 ID 누락은 모듈 구성을 거부한다', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', clientId);
    vi.stubEnv('APPLE_CLIENT_IDS', '');
    await expect(
      builder()
        .compile()
        .then(async (module) => {
          await module.close();
          return 'compiled';
        }),
    ).rejects.toThrow('APPLE_CLIENT_IDS');
  });

  it.each(['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET'])(
    '네이버 설정 %s 누락은 모듈 구성을 거부한다',
    async (key) => {
      vi.stubEnv('GOOGLE_CLIENT_ID', clientId);
      vi.stubEnv(key, '');
      await expect(
        builder()
          .compile()
          .then(async (module) => {
            await module.close();
            return 'compiled';
          }),
      ).rejects.toThrow(key);
    },
  );
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([undefined, '', ' ', '0', 'invalid-app-key'])(
    'KAKAO_APP_ID %j가 잘못되면 모듈 구성을 거부한다',
    async (appId) => {
      vi.stubEnv('GOOGLE_CLIENT_ID', clientId);
      vi.stubEnv('KAKAO_APP_ID', appId);
      await expect(
        builder()
          .compile()
          .then(async (module) => {
            await module.close();
            return 'compiled';
          }),
      ).rejects.toThrow('KAKAO_APP_ID');
    },
  );

  it('카카오 인증 결과로 회원을 연결하고 구글 어댑터를 호출하지 않는다', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', clientId);
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ id: 5678, app_id: 1234, expires_in: 100 }),
      );
    vi.stubGlobal('fetch', http);
    const google = { verifyIdToken: vi.fn() };
    const repository = {
      findBySocialAccount: vi.fn().mockResolvedValue({ id: 'kakao-user' }),
      createWithSocialAccount: vi.fn(),
    };
    const module = await builder()
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(repository)
      .overrideProvider(OAuth2Client)
      .useValue(google)
      .compile();
    try {
      await expect(
        module
          .get(SocialLoginUseCase)
          .execute({ provider: 'kakao', credential: 'access-token' }),
      ).resolves.toEqual({ id: 'kakao-user' });
      expect(repository.findBySocialAccount).toHaveBeenCalledExactlyOnceWith({
        provider: 'kakao',
        subject: '5678',
      });
      expect(google.verifyIdToken).not.toHaveBeenCalled();
      expect(http).toHaveBeenCalledOnce();
    } finally {
      await module.close();
    }
  });

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
