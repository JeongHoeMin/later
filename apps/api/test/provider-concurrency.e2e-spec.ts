import { Test } from '@nestjs/testing';
import { type INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import { GoogleAuthProvider } from '@auth/infrastructure/google/google-auth-provider.js';
import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { AUTH_SESSION_REPOSITORY } from '@auth/application/ports/auth-session.repository.js';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from '@auth/application/ports/access-token.js';
import { AuthCleanupScheduler } from '@auth/infrastructure/cleanup/auth-cleanup.scheduler.js';
import { SOCIAL_USER_REPOSITORY } from '@users/application/ports/social-user.repository.js';
import { USER_ACCOUNT_REPOSITORY } from '@users/application/ports/user-account.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';

describe('로그인/연동 제공자 동시 상한 HTTP', () => {
  let app: INestApplication<App>;
  let bearer: string;
  const limits = new TestAuthRateLimitRepository();
  const google = { provider: 'google', authenticate: vi.fn() };
  const users = {
    findBySocialAccount: vi.fn(),
    createWithSocialAccount: vi.fn(),
  };
  const accounts = { exists: async () => true, linkSocialAccount: vi.fn() };
  const sessions = { create: vi.fn() };
  let logError: ReturnType<typeof vi.spyOn>;
  let logInfo: ReturnType<typeof vi.spyOn>;
  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-secret');
    vi.stubEnv('AUTH_PROVIDER_MAX_CONCURRENCY', '1');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-only-access-secret-with-at-least-32-bytes',
    );
    logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    logInfo = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(AuthCleanupScheduler)
      .useValue({})
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(limits)
      .overrideProvider(GoogleAuthProvider)
      .useValue(google)
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(USER_ACCOUNT_REPOSITORY)
      .useValue(accounts)
      .overrideProvider(AUTH_SESSION_REPOSITORY)
      .useValue(sessions)
      .compile();
    bearer = (
      await module
        .get<AccessTokenIssuer>(ACCESS_TOKEN_ISSUER)
        .issue('8d4d5ef4-25fb-4694-9860-5caf9c051eea')
    ).accessToken;
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    limits.buckets.clear();
    google.authenticate.mockReset().mockResolvedValue({ subject: 'verified' });
    users.findBySocialAccount.mockReset().mockResolvedValue({ id: 'user' });
    users.createWithSocialAccount.mockReset();
    accounts.linkSocialAccount.mockReset().mockResolvedValue({
      id: 'linked',
      provider: 'google',
      linkedAt: new Date(),
    });
    sessions.create.mockReset().mockResolvedValue(undefined);
  });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
    logError?.mockRestore();
    logInfo?.mockRestore();
  });
  function post(path: string) {
    return request(app.getHttpServer())
      .post(path)
      .set('Connection', 'keep-alive')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ provider: 'google', credential: 'test-token' });
  }
  it('로그인이 진행 중이면 같은 제공자 연동을503으로 거부하고 슬롯 회복 뒤 허용한다', async () => {
    let release!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    google.authenticate.mockImplementationOnce(async () => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { subject: 'verified' };
    });
    const pending = post('/auth/social/login').then((response) => response);
    await ready;
    try {
      const denied = await post('/users/me/social-accounts').expect(503);
      expect(denied.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(google.authenticate).toHaveBeenCalledOnce();
      expect(accounts.linkSocialAccount).not.toHaveBeenCalled();
      expect(sessions.create).not.toHaveBeenCalled();
    } finally {
      release();
      expect((await pending).status).toBe(200);
    }
    await post('/users/me/social-accounts').expect(200);
    expect(accounts.linkSocialAccount).toHaveBeenCalledOnce();
  });
});
