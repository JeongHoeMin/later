import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';
import { Test } from '@nestjs/testing';
import { Logger, type INestApplication } from '@nestjs/common';
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
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from '@auth/application/ports/access-token.js';
import { USER_ACCOUNT_REPOSITORY } from '@users/application/ports/user-account.repository.js';
import { SOCIAL_USER_REPOSITORY } from '@users/application/ports/social-user.repository.js';
import { AUTH_SESSION_REPOSITORY } from '@auth/application/ports/auth-session.repository.js';
import {
  NAVER_LOGIN_ATTEMPTS,
  type NaverLoginAttempt,
} from '@auth/application/ports/naver-login-attempt.repository.js';
import { APPLE_LOGIN_ATTEMPT_REPOSITORY } from '@auth/application/ports/apple-login-attempt.repository.js';
import { GoogleAuthProvider } from '@auth/infrastructure/google/google-auth-provider.js';
import { AppleAuthProvider } from '@auth/infrastructure/apple/apple-auth-provider.js';
import { NaverAuthProvider } from '@auth/infrastructure/naver/naver-auth-provider.js';
import { SocialAccountConflictError } from '@users/domain/errors/social-account-conflict.error.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';
import { setupOpenApi } from '../src/common/openapi/setup-openapi.js';

const rateLimits = new TestAuthRateLimitRepository();

describe('소셜 계정 연동 HTTP', () => {
  let app: INestApplication<App>;
  let token: string;
  const userId = '03a6a909-2640-4e3e-a608-59056761083d';
  const account = {
    id: 'linked-account',
    provider: 'google',
    linkedAt: new Date('2026-10-03T00:00:00Z'),
  };
  const google = { provider: 'google', authenticate: vi.fn() };
  const apple = { provider: 'apple', authenticate: vi.fn() };
  const naver = {
    provider: 'naver',
    authenticate: vi.fn().mockResolvedValue({ subject: 'naver-subject' }),
  };
  const linkSocialAccount = vi.fn();
  const findBySocialAccount = vi.fn();
  const createSession = vi.fn().mockResolvedValue(undefined);
  const appleCreate = vi.fn().mockResolvedValue(undefined);
  type Attempt = NaverLoginAttempt & { sealedGrant?: string; used?: boolean };
  const attempts = new Map<string, Attempt>();
  const naverAttempts = {
    create: async (attempt: NaverLoginAttempt) => {
      attempts.set(attempt.id, attempt);
    },
    acceptCallback: async (hash: string, sealed: string) => {
      const a = [...attempts.values()].find(
        (a) => a.stateHash === hash && !a.sealedGrant && !a.used,
      );
      if (!a) return null;
      a.sealedGrant = sealed;
      return a.id;
    },
    consume: async (
      id: string,
      secretHash: string,
      _now: Date,
      ownerUserId?: string,
    ) => {
      const a = attempts.get(id);
      if (
        !a?.sealedGrant ||
        a.used ||
        a.secretHash !== secretHash ||
        a.ownerUserId !== ownerUserId
      )
        return null;
      a.used = true;
      return a.sealedGrant;
    },
  };
  beforeAll(async () => {
    for (const [key, value] of Object.entries({
      GOOGLE_CLIENT_ID: 'test',
      KAKAO_APP_ID: '1234',
      NAVER_CLIENT_ID: 'test',
      NAVER_CLIENT_SECRET: 'test',
      APPLE_CLIENT_IDS: 'test',
      ACCESS_TOKEN_SECRET: 'test-only-social-link-secret-more-than-32-bytes',
      NAVER_LOGIN_BRIDGE_KEY: Buffer.alloc(32, 7).toString('base64url'),
      NAVER_LOGIN_CALLBACK_URL: 'https://api.test/auth/social/naver/callback',
      NAVER_LOGIN_APP_RETURN_URL: 'later://auth/naver',
    }))
      vi.stubEnv(key, value);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(rateLimits)
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(USER_ACCOUNT_REPOSITORY)
      .useValue({ exists: async () => true, linkSocialAccount })
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue({ findBySocialAccount, createWithSocialAccount: vi.fn() })
      .overrideProvider(AUTH_SESSION_REPOSITORY)
      .useValue({ create: createSession })
      .overrideProvider(GoogleAuthProvider)
      .useValue(google)
      .overrideProvider(AppleAuthProvider)
      .useValue(apple)
      .overrideProvider(NaverAuthProvider)
      .useValue(naver)
      .overrideProvider(NAVER_LOGIN_ATTEMPTS)
      .useValue(naverAttempts)
      .overrideProvider(APPLE_LOGIN_ATTEMPT_REPOSITORY)
      .useValue({ create: appleCreate, consume: vi.fn() })
      .compile();
    app = module.createNestApplication();
    setupOpenApi(app);
    await app.init();
    token = (
      await module.get<AccessTokenIssuer>(ACCESS_TOKEN_ISSUER).issue(userId)
    ).accessToken;
  });
  beforeEach(() => {
    rateLimits.buckets.clear();
    attempts.clear();
    google.authenticate
      .mockReset()
      .mockResolvedValue({ subject: 'verified-google' });
    apple.authenticate
      .mockReset()
      .mockResolvedValue({ subject: 'verified-apple' });
    linkSocialAccount.mockReset().mockResolvedValue(account);
    createSession.mockClear();
    appleCreate.mockClear();
    findBySocialAccount.mockReset().mockResolvedValue({ id: userId });
  });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });
  const post = (path: string, body: object = {}, auth = true) => {
    const call = request(app.getHttpServer())
      .post(path)
      .set('Connection', 'keep-alive');
    if (auth) call.set('Authorization', `Bearer ${token}`);
    return call.send(body);
  };
  const link = (body: object) => post('/users/me/social-accounts', body);
  it('네이버 회원에게 구글을 연결하고 구글 로그인도 같은 회원을 반환한다', async () => {
    const response = await link({
      provider: 'google',
      credential: 'google-token',
    }).expect(200);
    expect(response.body).toEqual({
      ...account,
      linkedAt: account.linkedAt.toISOString(),
    });
    expect(linkSocialAccount).toHaveBeenCalledExactlyOnceWith(userId, {
      provider: 'google',
      subject: 'verified-google',
    });
    expect(createSession).not.toHaveBeenCalled();
    const login = await post(
      '/auth/social/login',
      { provider: 'google', credential: 'google-token' },
      false,
    ).expect(200);
    expect(login.body.user.id).toBe(userId);
  });
  it('타 회원 계정 또는 동일 제공자의 다른 계정은409로 거부한다', async () => {
    linkSocialAccount.mockRejectedValue(new SocialAccountConflictError());
    const response = await link({
      provider: 'google',
      credential: 'google-token',
    }).expect(409);
    expect(response.body.error.code).toBe('SOCIAL_ACCOUNT_CONFLICT');
    expect(createSession).not.toHaveBeenCalled();
  });
  it('잘못된 제공자 인증은401이며 연동을 저장하지 않는다', async () => {
    google.authenticate.mockRejectedValue(
      new SocialAuthenticationFailedError(),
    );
    const response = await link({
      provider: 'google',
      credential: 'bad-token',
    }).expect(401);
    expect(response.body.error.code).toBe('SOCIAL_AUTHENTICATION_FAILED');
    expect(linkSocialAccount).not.toHaveBeenCalled();
  });
  it('제공자 장애는503이며 연동을 저장하지 않는다', async () => {
    google.authenticate.mockRejectedValue(
      new SocialAuthenticationUnavailableError(),
    );
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      await link({ provider: 'google', credential: 'token' }).expect(503);
      expect(linkSocialAccount).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it.each([
    { provider: 'google', credential: 'token', userId: 'attacker' },
    { provider: 'google', credential: 'token', subject: 'attacker' },
    { provider: 'naver', credential: 'direct-code', state: 'state' },
  ])(
    '임의 회원/subject/네이버 직접 입력을400으로 거부한다 %j',
    async (body) => {
      await link(body).expect(400);
      expect(linkSocialAccount).not.toHaveBeenCalled();
    },
  );
  it('인증 없이 연동하거나 시도를 시작할 수 없다', async () => {
    for (const path of [
      '/users/me/social-accounts',
      '/users/me/social-accounts/apple/start',
      '/users/me/social-accounts/naver/start',
    ])
      await post(path, {}, false).expect(401);
    expect(linkSocialAccount).not.toHaveBeenCalled();
  });
  it('Apple 연동 시작은 JWT 회원에 묶인 nonce 시도를 생성한다', async () => {
    const { body } = await post('/users/me/social-accounts/apple/start').expect(
      201,
    );
    expect(appleCreate.mock.calls[0][0]).toMatchObject({
      id: body.loginAttemptId,
      ownerUserId: userId,
    });
    await link({
      provider: 'apple',
      credential: 'apple-token',
      loginAttemptId: body.loginAttemptId,
    }).expect(200);
    expect(apple.authenticate).toHaveBeenCalledWith(
      'apple-token',
      body.loginAttemptId,
      userId,
    );
  });
  it('Naver 연동 시도는 일반 로그인으로 사용할 수 없고 콜백 후 연동에서만 소비한다', async () => {
    const { body: start } = await post(
      '/users/me/social-accounts/naver/start',
    ).expect(201);
    const state = new URL(start.authorizationUrl).searchParams.get('state');
    await request(app.getHttpServer())
      .get('/auth/social/naver/callback')
      .set('Connection', 'keep-alive')
      .query({ code: 'code', state })
      .expect(303);
    const body = {
      provider: 'naver',
      loginAttemptId: start.loginAttemptId,
      attemptSecret: start.attemptSecret,
    };
    await post('/auth/social/login', body, false).expect(401);
    await link(body).expect(200);
    expect(linkSocialAccount).toHaveBeenCalledWith(userId, {
      provider: 'naver',
      subject: 'naver-subject',
    });
    expect(createSession).not.toHaveBeenCalled();
    await link(body).expect(401);
  });
  it('일반 Naver 로그인 시도를 연동에 사용할 수 없다', async () => {
    const { body: start } = await post(
      '/auth/social/naver/start',
      {},
      false,
    ).expect(201);
    const state = new URL(start.authorizationUrl).searchParams.get('state');
    await request(app.getHttpServer())
      .get('/auth/social/naver/callback')
      .set('Connection', 'keep-alive')
      .query({ code: 'code', state })
      .expect(303);
    await link({
      provider: 'naver',
      loginAttemptId: start.loginAttemptId,
      attemptSecret: start.attemptSecret,
    }).expect(401);
    expect(linkSocialAccount).not.toHaveBeenCalled();
  });
  it.each(['apple', 'naver'])(
    '연동 시작에는 입력 필드를 받지 않는다 %s',
    async (provider) => {
      await post(`/users/me/social-accounts/${provider}/start`, {
        userId: 'attacker',
      }).expect(400);
    },
  );
  it('OpenAPI에 네 제공자 연동·409·시작의 Bearer 계약을 제공한다', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/docs-json')
      .set('Connection', 'keep-alive')
      .expect(200);
    const op = body.paths['/users/me/social-accounts'].post;
    expect(op.security).toEqual([{ bearer: [] }]);
    expect(
      op.requestBody.content['application/json'].schema.oneOf,
    ).toHaveLength(4);
    expect(op.responses['409']).toBeDefined();
    for (const provider of ['apple', 'naver'])
      expect(
        body.paths[`/users/me/social-accounts/${provider}/start`].post.security,
      ).toEqual([{ bearer: [] }]);
  });
});
