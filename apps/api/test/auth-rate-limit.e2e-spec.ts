import { Test } from '@nestjs/testing';
import { type INestApplication, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
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
import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from '@auth/application/ports/access-token.js';
import { USER_ACCOUNT_REPOSITORY } from '@users/application/ports/user-account.repository.js';
import { SocialSignInUseCase } from '@auth/application/social-sign-in.use-case.js';
import { StartAppleLoginUseCase } from '@auth/application/start-apple-login.use-case.js';
import { NaverLoginFlow } from '@auth/application/naver-login-flow.js';
import { RefreshSessionUseCase } from '@auth/application/refresh-session.use-case.js';
import { LogoutSessionUseCase } from '@auth/application/logout-session.use-case.js';
import { LinkSocialAccountUseCase } from '@auth/application/link-social-account.use-case.js';
import { readTrustedProxyCidrs } from '@auth/infrastructure/rate-limit/client-ip.js';
import { setupOpenApi } from '../src/common/openapi/setup-openapi.js';

describe('인증 API 요청 제한 HTTP', () => {
  let app: INestApplication<App>;
  let issuer: AccessTokenIssuer;
  let token: string;
  let clock = 0;
  const store = new TestAuthRateLimitRepository(() => clock);
  const login = vi.fn().mockResolvedValue({
    user: { id: 'member' },
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
    tokenType: 'Bearer',
    expiresIn: 900,
  });
  const apple = vi.fn().mockResolvedValue({
    loginAttemptId: 'attempt',
    nonce: 'nonce',
    expiresIn: 300,
  });
  const start = vi.fn().mockResolvedValue({ loginAttemptId: 'attempt' });
  const callback = vi
    .fn()
    .mockResolvedValue('later://auth/naver?loginAttemptId=attempt');
  const refresh = vi.fn().mockResolvedValue({
    accessToken: 'access',
    refreshToken: 'refresh',
    tokenType: 'Bearer',
    expiresIn: 900,
  });
  const logout = vi.fn().mockResolvedValue(undefined);
  const link = vi.fn().mockResolvedValue({
    id: 'account',
    provider: 'google',
    linkedAt: new Date(0),
  });
  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('NAVER_CLIENT_ID', 'test');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test');
    vi.stubEnv('APPLE_CLIENT_IDS', 'test');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-only-rate-limit-secret-more-than-32-bytes',
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(store)
      .overrideProvider(USER_ACCOUNT_REPOSITORY)
      .useValue({
        exists: async () => true,
        listSocialAccounts: async () => [],
        withdraw: async () => {},
      })
      .overrideProvider(SocialSignInUseCase)
      .useValue({ execute: login })
      .overrideProvider(StartAppleLoginUseCase)
      .useValue({ execute: apple })
      .overrideProvider(NaverLoginFlow)
      .useValue({ start, callback, complete: login })
      .overrideProvider(RefreshSessionUseCase)
      .useValue({ execute: refresh })
      .overrideProvider(LogoutSessionUseCase)
      .useValue({ execute: logout })
      .overrideProvider(LinkSocialAccountUseCase)
      .useValue({ execute: link })
      .compile();
    app = module.createNestApplication();
    setupOpenApi(app);
    await app.init();
    issuer = module.get(ACCESS_TOKEN_ISSUER);
    token = (await issuer.issue('56d32212-10d5-4b98-a959-836f0b097271'))
      .accessToken;
  });
  beforeEach(() => {
    store.buckets.clear();
    clock = 0;
    vi.clearAllMocks();
    (app as NestExpressApplication).set('trust proxy', false);
  });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });
  const post = (path: string, body: object = {}, auth = false, ip?: string) => {
    const call = request(app.getHttpServer())
      .post(path)
      .set('Connection', 'keep-alive');
    if (auth) call.set('Authorization', `Bearer ${token}`);
    if (ip) call.set('X-Forwarded-For', ip);
    return call.send(body);
  };
  const credential = { provider: 'google', credential: 'test-provider-token' };
  it('20회 로그인 이후 외부 인증 전에 429와 Retry-After를 반환하고 60초 후 해제한다', async () => {
    for (let i = 0; i < 20; i++)
      expect((await post('/auth/social/login', credential)).status).toBe(200);
    const blocked = await post('/auth/social/login', credential);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blocked.headers['retry-after']).toBe('60');
    expect(login).toHaveBeenCalledTimes(20);
    clock = 59001;
    expect(
      (await post('/auth/social/login', credential)).headers['retry-after'],
    ).toBe('1');
    clock = 60000;
    expect((await post('/auth/social/login', credential)).status).toBe(200);
    for (const key of store.buckets.keys()) {
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toContain('test-provider-token');
    }
  });
  it('로그인·두 시작·callback이 같은 IP 예산을 공유한다', async () => {
    for (let i = 0; i < 17; i++) await post('/auth/social/login', credential);
    expect((await post('/auth/social/apple/start')).status).toBe(201);
    expect((await post('/auth/social/naver/start')).status).toBe(201);
    expect(
      (
        await request(app.getHttpServer()).get(
          '/auth/social/naver/callback?code=test-code&state=test-state',
        )
      ).status,
    ).toBe(303);
    expect((await post('/auth/social/apple/start')).status).toBe(429);
    expect(apple).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['/auth/token/refresh', 200],
    ['/auth/logout', 204],
  ] as const)(
    '%s는 60회 허용하며 로그인 예산과 분리한다',
    async (path, status) => {
      for (let i = 0; i < 20; i++) await post('/auth/social/login', credential);
      for (let i = 0; i < 60; i++)
        expect(
          (await post(path, { refreshToken: 'opaque-test-refresh' })).status,
        ).toBe(status);
      expect(
        (await post(path, { refreshToken: 'opaque-test-refresh' })).status,
      ).toBe(429);
      expect(path.endsWith('refresh') ? refresh : logout).toHaveBeenCalledTimes(
        60,
      );
    },
  );
  it('유효하지 않은 요청과 미인증 연동도 IP 횟수를 소비한다', async () => {
    for (let i = 0; i < 20; i++)
      expect((await post('/auth/social/login', {})).status).toBe(400);
    expect((await post('/auth/social/login', credential)).status).toBe(429);
    expect(login).not.toHaveBeenCalled();
    for (let i = 0; i < 10; i++)
      expect((await post('/users/me/social-accounts', credential)).status).toBe(
        401,
      );
    expect(
      (await post('/users/me/social-accounts', credential, true)).status,
    ).toBe(429);
    expect(link).not.toHaveBeenCalled();
  });
  it('연동·연동 시작은 IP 예산을 공유하며 읽기 API는 제한하지 않는다', async () => {
    for (let i = 0; i < 8; i++)
      expect(
        (await post('/users/me/social-accounts', credential, true)).status,
      ).toBe(200);
    expect(
      (await post('/users/me/social-accounts/apple/start', {}, true)).status,
    ).toBe(201);
    expect(
      (await post('/users/me/social-accounts/naver/start', {}, true)).status,
    ).toBe(201);
    expect(
      (await post('/users/me/social-accounts', credential, true)).status,
    ).toBe(429);
    expect(link).toHaveBeenCalledTimes(8);
    expect(
      (
        await request(app.getHttpServer())
          .get('/users/me/social-accounts')
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(200);
  });
  it('동일 회원은 IP를 바꿔도 10회만 연동하며 다른 회원·IP는 독립적이다', async () => {
    (app as NestExpressApplication).set(
      'trust proxy',
      readTrustedProxyCidrs('::ffff:127.0.0.1/128,::1/128'),
    );
    for (let i = 0; i < 10; i++)
      expect(
        (
          await post(
            '/users/me/social-accounts',
            credential,
            true,
            `192.0.2.${i + 1}`,
          )
        ).status,
      ).toBe(200);
    expect(
      (await post('/users/me/social-accounts', credential, true, '192.0.2.50'))
        .status,
    ).toBe(429);
    token = (await issuer.issue('fd74eb38-bc5f-4eb0-b478-1778f6d15865'))
      .accessToken;
    expect(
      (await post('/users/me/social-accounts', credential, true, '192.0.2.51'))
        .status,
    ).toBe(200);
  });
  it('같은 IP의 다른 회원도 연동 IP 예산을 공유한다', async () => {
    for (let i = 0; i < 9; i++)
      expect(
        (await post('/users/me/social-accounts', credential, true)).status,
      ).toBe(200);
    token = (await issuer.issue('aedfd9d0-64e2-4b3e-8172-135c93ee0796'))
      .accessToken;
    expect(
      (await post('/users/me/social-accounts', credential, true)).status,
    ).toBe(200);
    expect(
      (await post('/users/me/social-accounts', credential, true)).status,
    ).toBe(429);
  });
  it('동일 IP의 IPv4와 mapped IPv6 표기는 같은 로그인 카운터를 사용한다', async () => {
    (app as NestExpressApplication).set(
      'trust proxy',
      readTrustedProxyCidrs('::ffff:127.0.0.1/128,::1/128'),
    );
    for (let i = 0; i < 20; i++)
      expect(
        (await post('/auth/social/login', credential, false, '192.0.2.1'))
          .status,
      ).toBe(200);
    expect(
      (await post('/auth/social/login', credential, false, '::ffff:c000:201'))
        .status,
    ).toBe(429);
    expect(store.buckets.size).toBe(1);
  });
  it('갱신 예산을 모두 소비해도 로그아웃 예산은 유지한다', async () => {
    for (let i = 0; i < 60; i++)
      expect(
        (
          await post('/auth/token/refresh', {
            refreshToken: 'opaque-test-refresh',
          })
        ).status,
      ).toBe(200);
    expect(
      (
        await post('/auth/token/refresh', {
          refreshToken: 'opaque-test-refresh',
        })
      ).status,
    ).toBe(429);
    expect(
      (await post('/auth/logout', { refreshToken: 'opaque-test-refresh' }))
        .status,
    ).toBe(204);
  });
  it('미신뢰 X-Forwarded-For 변경으로 IP 제한을 우회할 수 없다', async () => {
    for (let i = 0; i < 20; i++)
      await post('/auth/social/login', credential, false, `192.0.2.${i + 1}`);
    expect(
      (await post('/auth/social/login', credential, false, '192.0.2.100'))
        .status,
    ).toBe(429);
  });
  it('저장소 장애 시 인증 처리를 진행하지 않고 내부 내용을 응답에 노출하지 않는다', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(store, 'consume').mockRejectedValueOnce(
      new Error('private-database-error'),
    );
    const response = await post('/auth/social/login', credential);
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('private-database');
    expect(login).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('OpenAPI에 제한 경로의 429와 Retry-After를 제공한다', async () => {
    const { body } = await request(app.getHttpServer()).get('/docs-json');
    for (const [path, method] of [
      ['/auth/social/login', 'post'],
      ['/auth/social/apple/start', 'post'],
      ['/auth/social/naver/callback', 'get'],
      ['/auth/token/refresh', 'post'],
      ['/auth/logout', 'post'],
      ['/users/me/social-accounts', 'post'],
      ['/users/me/social-accounts/apple/start', 'post'],
    ]) {
      expect(
        body.paths[path][method].responses['429'].headers['Retry-After'].schema
          .type,
      ).toBe('integer');
    }
  });
});
