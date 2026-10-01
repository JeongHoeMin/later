import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
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
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { AUTH_SESSION_REPOSITORY } from '@auth/application/ports/auth-session.repository.js';
import { createHash } from 'node:crypto';
import { jwtVerify } from 'jose';

describe('POST /auth/social/login (e2e)', () => {
  let app: INestApplication<App>;
  const google = { provider: 'google', authenticate: vi.fn() };
  const repository = {
    findBySocialAccount: vi.fn(),
    createWithSocialAccount: vi.fn(),
  };
  const logError = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});
  const sessions = { create: vi.fn() };
  const secret = 'test-only-access-secret-with-at-least-32-bytes';

  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'e2e-client.apps.googleusercontent.com');
    vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(GoogleAuthProvider)
      .useValue(google)
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(repository)
      .overrideProvider(AUTH_SESSION_REPOSITORY)
      .useValue(sessions)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    google.authenticate
      .mockReset()
      .mockResolvedValue({ subject: 'verified-subject' });
    repository.findBySocialAccount
      .mockReset()
      .mockResolvedValue({ id: 'existing-user' });
    repository.createWithSocialAccount.mockReset();
    sessions.create.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
      logError.mockRestore();
    }
  });

  function login(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/auth/social/login')
      .set('Connection', 'keep-alive')
      .send(body);
  }

  it('기존 회원은 200과 회원 ID를 반환한다', async () => {
    const response = await login({
      provider: 'google',
      credential: 'id-token',
    }).expect(200);
    expect(response.body).toEqual({
      user: { id: 'existing-user' },
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
    expect(verified.payload.sub).toBe('existing-user');
    expect(sessions.create).toHaveBeenCalledWith({
      userId: 'existing-user',
      tokenHash: createHash('sha256')
        .update(response.body.refreshToken)
        .digest('hex'),
      expiresAt: expect.any(Date),
    });
    expect(google.authenticate).toHaveBeenCalledExactlyOnceWith('id-token');
    expect(repository.findBySocialAccount).toHaveBeenCalledExactlyOnceWith({
      provider: 'google',
      subject: 'verified-subject',
    });
    expect(repository.createWithSocialAccount).not.toHaveBeenCalled();
  });

  it('신규 회원도 같은 경로에서 생성하고 200을 반환한다', async () => {
    repository.findBySocialAccount.mockResolvedValue(null);
    repository.createWithSocialAccount.mockResolvedValue({ id: 'new-user' });
    const response = await login({
      provider: 'google',
      credential: 'id-token',
    }).expect(200);
    expect(response.body).toEqual({
      user: { id: 'new-user' },
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(repository.createWithSocialAccount).toHaveBeenCalledExactlyOnceWith({
      provider: 'google',
      subject: 'verified-subject',
    });
  });

  it.each([
    {},
    { provider: 'google', credential: '   ' },
    { provider: 'kakao', credential: 'id-token' },
    { provider: 'google', credential: 'id-token', subject: 'fake-subject' },
  ])('잘못된 요청 %j는 인증 전에 400을 반환한다', async (body) => {
    const response = await login(body).expect(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(response.body.error.details.length).toBeGreaterThan(0);
    expect(google.authenticate).not.toHaveBeenCalled();
    expect(repository.findBySocialAccount).not.toHaveBeenCalled();
    expect(repository.createWithSocialAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('인증 실패는 공통 401 응답으로 변환한다', async () => {
    google.authenticate.mockRejectedValue(
      new SocialAuthenticationFailedError(),
    );
    const response = await login({
      provider: 'google',
      credential: 'invalid-token',
    }).expect(401);
    expect(response.body).toEqual({
      error: {
        code: 'SOCIAL_AUTHENTICATION_FAILED',
        message: '소셜 인증에 실패했습니다.',
      },
    });
    expect(repository.findBySocialAccount).not.toHaveBeenCalled();
    expect(repository.createWithSocialAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('DB 오류는 인증 실패로 바꾸지 않고 내부 내용을 숨긴 500을 반환한다', async () => {
    repository.findBySocialAccount.mockRejectedValue(
      new Error('private database error'),
    );
    const response = await login({
      provider: 'google',
      credential: 'id-token',
    }).expect(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류가 발생했습니다.',
      },
    });
  });

  it('세션 저장에 실패하면 토큰을 포함하지 않은 500을 반환한다', async () => {
    sessions.create.mockRejectedValue(new Error('session storage failed'));
    const response = await login({
      provider: 'google',
      credential: 'id-token',
    }).expect(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류가 발생했습니다.',
      },
    });
  });
});
