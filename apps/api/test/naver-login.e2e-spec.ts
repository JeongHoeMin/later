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

describe('네이버 소셜 로그인 (e2e)', () => {
  let app: INestApplication<App>;
  const http = vi.fn<typeof fetch>();
  const users = {
    findBySocialAccount: vi.fn(),
    createWithSocialAccount: vi.fn(),
  };
  const sessions = { create: vi.fn() };
  const secret = 'test-only-access-secret-with-at-least-32-bytes';
  const token = {
    access_token: 'naver-token',
    refresh_token: 'provider-refresh',
    token_type: 'bearer',
    expires_in: '3600',
  };
  let log: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('NAVER_CLIENT_ID', 'our-naver-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'our-naver-secret');
    vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
    vi.stubGlobal('fetch', http);
    log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(GoogleAuthProvider)
      .useValue({ provider: 'google', authenticate: vi.fn() })
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(AUTH_SESSION_REPOSITORY)
      .useValue(sessions)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    http
      .mockReset()
      .mockResolvedValueOnce(Response.json(token))
      .mockResolvedValueOnce(
        Response.json({
          resultcode: '00',
          message: 'success',
          response: { id: 'naver-subject' },
        }),
      );
    users.findBySocialAccount
      .mockReset()
      .mockResolvedValue({ id: 'existing-naver-user' });
    users.createWithSocialAccount
      .mockReset()
      .mockResolvedValue({ id: 'new-naver-user' });
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
      provider: 'naver',
      credential: 'authorization-code',
      state: 'client-validated-state',
    },
  ) {
    return request(app.getHttpServer())
      .post('/auth/social/login')
      .set('Connection', 'keep-alive')
      .send(body);
  }
  it.each(['existing', 'new'])(
    '%s 회원에게 서비스 토큰을 발급한다',
    async (kind) => {
      if (kind === 'new') users.findBySocialAccount.mockResolvedValue(null);
      const response = await login().expect(200);
      const userId = kind === 'new' ? 'new-naver-user' : 'existing-naver-user';
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
        provider: 'naver',
        subject: 'naver-subject',
      });
      if (kind === 'new')
        expect(users.createWithSocialAccount).toHaveBeenCalledExactlyOnceWith({
          provider: 'naver',
          subject: 'naver-subject',
        });
      else expect(users.createWithSocialAccount).not.toHaveBeenCalled();
      expect(sessions.create).toHaveBeenCalledExactlyOnceWith({
        userId,
        tokenHash: createHash('sha256')
          .update(response.body.refreshToken)
          .digest('hex'),
        expiresAt: expect.any(Date),
      });
      const body = new URLSearchParams(String(http.mock.calls[0][1]?.body));
      expect(body.get('code')).toBe('authorization-code');
      expect(body.get('state')).toBe('client-validated-state');
      expect(body.get('client_id')).toBe('our-naver-client');
      expect(response.text).not.toContain('provider-refresh');
    },
  );
  it.each([
    [
      200,
      { error: 'unauthorized_client', error_description: 'private credential' },
      401,
      'SOCIAL_AUTHENTICATION_FAILED',
    ],
    [
      503,
      { error: 'server_error', error_description: 'private credential' },
      503,
      'INTERNAL_SERVER_ERROR',
    ],
    [200, {}, 503, 'INTERNAL_SERVER_ERROR'],
  ])(
    '외부 실패 %i %j는 저장 없이 공통 오류로 처리한다',
    async (status, body, expectedStatus, code) => {
      http.mockReset().mockResolvedValue(Response.json(body, { status }));
      const response = await login().expect(expectedStatus);
      expect(response.body.error.code).toBe(code);
      expect(response.text).not.toContain('private credential');
      expect(response.text).not.toContain('authorization-code');
      expect(users.findBySocialAccount).not.toHaveBeenCalled();
      expect(users.createWithSocialAccount).not.toHaveBeenCalled();
      expect(sessions.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    { provider: 'naver', credential: 'code' },
    { provider: 'naver', credential: 'code', state: '' },
    { provider: 'naver', credential: 'code', state: 'state', subject: 'fake' },
  ])('잘못된 입력은 외부 호출 전에 400이다', async (body) => {
    await login(body).expect(400);
    expect(http).not.toHaveBeenCalled();
    expect(users.findBySocialAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });
});
