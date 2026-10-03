import { Test } from '@nestjs/testing';
import { Logger, type INestApplication } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { SignJWT, generateKeyPair, exportSPKI } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { AUTH_SESSION_REPOSITORY } from '@auth/application/ports/auth-session.repository.js';
import { AuthCleanupScheduler } from '@auth/infrastructure/cleanup/auth-cleanup.scheduler.js';
import { SOCIAL_USER_REPOSITORY } from '@users/application/ports/social-user.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';

// Google SDK, its Nest client factory, JWT verification and HTTP pipeline stay real.
describe('Google 인증서 장애 HTTP 계약', () => {
  let app: INestApplication<App>;
  let credential: string;
  let certificates: Record<string, string>;
  const clientId = 'test-google-client';
  const http = vi.fn<typeof fetch>();
  const users = {
    findBySocialAccount: vi.fn(),
    createWithSocialAccount: vi.fn(),
  };
  const sessions = { create: vi.fn() };
  let logError: ReturnType<typeof vi.spyOn>;
  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', clientId);
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-naver-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-naver-secret');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-only-secret-with-at-least-32-bytes',
    );
    logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const keys = await generateKeyPair('RS256');
    certificates = { 'test-key': await exportSPKI(keys.publicKey) };
    credential = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('test-google-subject')
      .setIssuer('https://accounts.google.com')
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keys.privateKey);
  });
  beforeEach(async () => {
    http.mockReset();
    users.findBySocialAccount
      .mockReset()
      .mockResolvedValue({ id: 'test-user' });
    users.createWithSocialAccount.mockReset();
    sessions.create.mockReset().mockResolvedValue(undefined);
    logError.mockClear();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(AuthCleanupScheduler)
      .useValue({})
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(new TestAuthRateLimitRepository())
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(AUTH_SESSION_REPOSITORY)
      .useValue(sessions)
      .compile();
    module.get(OAuth2Client).transporter.defaults.fetchImplementation = http;
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });
  afterAll(() => {
    logError?.mockRestore();
    vi.unstubAllEnvs();
  });
  function login(value = credential) {
    return request(app.getHttpServer())
      .post('/auth/social/login')
      .set('Connection', 'keep-alive')
      .send({ provider: 'google', credential: value });
  }
  function noStorage() {
    expect(users.findBySocialAccount).not.toHaveBeenCalled();
    expect(users.createWithSocialAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  }
  it('인증서 HTTP 장애는 재시도/저장 없이503이며 원문과 토큰을 숨긴다', async () => {
    http.mockImplementation(async () =>
      Response.json({ private: credential }, { status: 503 }),
    );
    const response = await login().expect(503);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류가 발생했습니다.',
      },
    });
    expect(http).toHaveBeenCalledOnce();
    noStorage();
    expect(JSON.stringify(logError.mock.calls)).not.toContain(credential);
  });
  it('네트워크 오류도401로 오인하지 않고503으로 처리한다', async () => {
    http.mockRejectedValue(new Error('private-network-detail'));
    const response = await login().expect(503);
    expect(JSON.stringify(response.body)).not.toContain(
      'private-network-detail',
    );
    expect(http).toHaveBeenCalledOnce();
    noStorage();
  });
  it('잘못된 인증서 응답 뒤 정상 응답으로 복구해 실제 JWT로 로그인한다', async () => {
    http
      .mockResolvedValueOnce(
        Response.json({}, { headers: { 'cache-control': 'max-age=3600' } }),
      )
      .mockImplementation(async () =>
        Response.json(certificates, {
          headers: { 'cache-control': 'max-age=3600' },
        }),
      );
    await login().expect(503);
    noStorage();
    const response = await login().expect(200);
    expect(response.body.user).toEqual({ id: 'test-user' });
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(users.findBySocialAccount).toHaveBeenCalledExactlyOnceWith({
      provider: 'google',
      subject: 'test-google-subject',
    });
    expect(sessions.create).toHaveBeenCalledOnce();
    expect(http).toHaveBeenCalledTimes(2);
  });
  it('정상 인증서로 검증한 잘못된 JWT는 기존401이며 저장하지 않는다', async () => {
    http.mockImplementation(async () => Response.json(certificates));
    const response = await login('not-a-jwt').expect(401);
    expect(response.body.error.code).toBe('SOCIAL_AUTHENTICATION_FAILED');
    noStorage();
  });
});
