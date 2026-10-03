import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';
import { createHash } from 'node:crypto';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { jwtVerify } from 'jose';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import { GoogleAuthProvider } from '@auth/infrastructure/google/google-auth-provider.js';
import { SOCIAL_USER_REPOSITORY } from '@users/application/ports/social-user.repository.js';
import { AUTH_SESSION_REPOSITORY } from '@auth/application/ports/auth-session.repository.js';

const rateLimits = new TestAuthRateLimitRepository();

describe('카카오 소셜 로그인 (e2e)', () => {
  let app: INestApplication<App>;
  const http = vi.fn<typeof fetch>();
  const google = { provider: 'google', authenticate: vi.fn() };
  const users = {
    findBySocialAccount: vi.fn(),
    createWithSocialAccount: vi.fn(),
  };
  const sessions = { create: vi.fn() };
  const valid = { id: 123456789, app_id: 1234, expires_in: 100 };
  const secret = 'test-only-access-secret-with-at-least-32-bytes';
  let log: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-naver-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-naver-secret');
    vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
    vi.stubGlobal('fetch', http);
    log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(rateLimits)
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(GoogleAuthProvider)
      .useValue(google)
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(AUTH_SESSION_REPOSITORY)
      .useValue(sessions)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    rateLimits.buckets.clear();
    http.mockReset().mockResolvedValue(Response.json(valid));
    google.authenticate.mockReset();
    users.findBySocialAccount
      .mockReset()
      .mockResolvedValue({ id: 'existing-kakao-user' });
    users.createWithSocialAccount
      .mockReset()
      .mockResolvedValue({ id: 'new-kakao-user' });
    sessions.create.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      log?.mockRestore();
    }
  });

  function login(
    body: Record<string, unknown> = {
      provider: 'kakao',
      credential: 'kakao-access-token',
    },
  ) {
    return request(app.getHttpServer())
      .post('/auth/social/login')
      .set('Connection', 'keep-alive')
      .send(body);
  }

  it.each(['existing', 'new'])(
    '%s 카카오 회원에게 서비스 토큰 쌍을 반환한다',
    async (kind) => {
      if (kind === 'new') users.findBySocialAccount.mockResolvedValue(null);
      const response = await login().expect(200);
      const userId = kind === 'new' ? 'new-kakao-user' : 'existing-kakao-user';
      expect(response.body).toEqual({
        user: { id: userId },
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
      });
      const verified = await jwtVerify(
        response.body.accessToken,
        new TextEncoder().encode(secret),
        { issuer: 'later-api', audience: 'later-mobile' },
      );
      expect(verified.payload.sub).toBe(userId);
      expect(users.findBySocialAccount).toHaveBeenCalledExactlyOnceWith({
        provider: 'kakao',
        subject: '123456789',
      });
      expect(sessions.create).toHaveBeenCalledExactlyOnceWith({
        userId,
        tokenHash: createHash('sha256')
          .update(response.body.refreshToken)
          .digest('hex'),
        expiresAt: expect.any(Date),
      });
      if (kind === 'new')
        expect(users.createWithSocialAccount).toHaveBeenCalledExactlyOnceWith({
          provider: 'kakao',
          subject: '123456789',
        });
      else expect(users.createWithSocialAccount).not.toHaveBeenCalled();
      expect(google.authenticate).not.toHaveBeenCalled();
    },
  );

  it.each([
    [401, { code: -401 }],
    [200, { ...valid, app_id: 9999 }],
    [200, { ...valid, expires_in: 0 }],
  ])(
    '토큰 검증 실패 %i는 회원과 세션을 처리하지 않고 401을 반환한다',
    async (status, body) => {
      http.mockResolvedValue(Response.json(body, { status }));
      const response = await login().expect(401);
      expect(response.body.error.code).toBe('SOCIAL_AUTHENTICATION_FAILED');
      expect(users.findBySocialAccount).not.toHaveBeenCalled();
      expect(users.createWithSocialAccount).not.toHaveBeenCalled();
      expect(sessions.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    [400, { code: -1 }],
    [503, { msg: 'private server details' }],
    [200, {}],
  ])(
    '카카오 장애 또는 응답 오류 %i는 공통 503으로 처리한다',
    async (status, body) => {
      http.mockResolvedValue(Response.json(body, { status }));
      const response = await login().expect(503);
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
        },
      });
      expect(users.findBySocialAccount).not.toHaveBeenCalled();
      expect(sessions.create).not.toHaveBeenCalled();
    },
  );

  it('외부 통신 오류는 401로 오인하지 않고 503을 반환한다', async () => {
    http.mockRejectedValue(new TypeError('private network details'));
    const response = await login().expect(503);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(users.findBySocialAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it.each([
    { provider: 'kakao', credential: ' ' },
    { provider: 'kakao', credential: 'token', subject: 'fake' },
    { provider: 'naver', credential: 'token' },
  ])('잘못된 본문 %j는 외부 호출 전에 400을 반환한다', async (body) => {
    await login(body).expect(400);
    expect(http).not.toHaveBeenCalled();
    expect(users.findBySocialAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('회원 저장소 오류는 외부 인증 장애로 바꾸지 않고 500을 반환한다', async () => {
    users.findBySocialAccount.mockRejectedValue(
      new Error('private DB details'),
    );
    const response = await login().expect(500);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(sessions.create).not.toHaveBeenCalled();
  });
});
