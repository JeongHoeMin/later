import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';
import { USER_ACCOUNT_REPOSITORY } from '@users/application/ports/user-account.repository.js';
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
import {
  NAVER_LOGIN_ATTEMPTS,
  type NaverLoginAttempt,
} from '@auth/application/ports/naver-login-attempt.repository.js';
import { AUTH_SESSION_REPOSITORY } from '@auth/application/ports/auth-session.repository.js';

const rateLimits = new TestAuthRateLimitRepository();

describe('네이버 소셜 로그인 (e2e)', () => {
  let app: INestApplication<App>;
  const http = vi.fn<typeof fetch>();
  const users = {
    findBySocialAccount: vi.fn(),
    createWithSocialAccount: vi.fn(),
  };
  const rows = new Map<
    string,
    NaverLoginAttempt & { grant?: string; used?: boolean }
  >();
  const attempts = {
    create: async (value: NaverLoginAttempt) => {
      rows.set(value.id, value);
    },
    acceptCallback: async (hash: string, grant: string, now: Date) => {
      const row = [...rows.values()].find(
        (v) => v.stateHash === hash && !v.grant && !v.used && v.expiresAt > now,
      );
      if (!row) return null;
      row.grant = grant;
      return row.id;
    },
    consume: async (id: string, hash: string, now: Date) => {
      const row = rows.get(id);
      if (
        !row ||
        row.secretHash !== hash ||
        !row.grant ||
        row.used ||
        row.expiresAt <= now
      )
        return null;
      row.used = true;
      const grant = row.grant;
      delete row.grant;
      return grant;
    },
  };
  let currentState: string;
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
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('NAVER_CLIENT_ID', 'our-naver-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'our-naver-secret');
    vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
    vi.stubEnv(
      'NAVER_LOGIN_CALLBACK_URL',
      'https://later.hoe.pe.kr/auth/social/naver/callback',
    );
    vi.stubEnv('NAVER_LOGIN_APP_RETURN_URL', 'later://auth/naver');
    vi.stubEnv(
      'NAVER_LOGIN_BRIDGE_KEY',
      Buffer.alloc(32, 7).toString('base64url'),
    );
    vi.stubGlobal('fetch', http);
    log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_ACCOUNT_REPOSITORY)
      .useValue({ exists: async () => true })
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(rateLimits)
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(NAVER_LOGIN_ATTEMPTS)
      .useValue(attempts)
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
    rateLimits.buckets.clear();
    rows.clear();
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
  function post(path: string, body: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post(path)
      .set('Connection', 'keep-alive')
      .send(body);
  }
  function callback(
    state: string,
    values: Record<string, string> = { code: 'authorization-code' },
  ) {
    return request(app.getHttpServer())
      .get('/auth/social/naver/callback')
      .set('Connection', 'keep-alive')
      .query({ state, ...values });
  }
  async function startLogin() {
    const response = await post('/auth/social/naver/start').expect(201);
    currentState = new URL(response.body.authorizationUrl).searchParams.get(
      'state',
    )!;
    return response.body as {
      loginAttemptId: string;
      attemptSecret: string;
      authorizationUrl: string;
      expiresIn: number;
    };
  }
  async function login() {
    const started = await startLogin();
    await callback(currentState).expect(303);
    return post('/auth/social/login', {
      provider: 'naver',
      loginAttemptId: started.loginAttemptId,
      attemptSecret: started.attemptSecret,
    });
  }
  it.each(['existing', 'new'])(
    '%s 회원에게 서비스 토큰을 발급한다',
    async (kind) => {
      if (kind === 'new') users.findBySocialAccount.mockResolvedValue(null);
      const response = await login();
      expect(response.status).toBe(200);
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
      expect(body.get('state')).toBe(currentState);
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
      const response = await login();
      expect(response.status).toBe(expectedStatus);
      expect(response.body.error.code).toBe(code);
      expect(response.text).not.toContain('private credential');
      expect(response.text).not.toContain('authorization-code');
      expect(users.findBySocialAccount).not.toHaveBeenCalled();
      expect(users.createWithSocialAccount).not.toHaveBeenCalled();
      expect(sessions.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    { provider: 'naver', credential: 'code', state: 'valid-state' },
    { provider: 'naver', credential: 'code' },
    { provider: 'naver', credential: 'code', state: '' },
    { provider: 'naver', credential: 'code', state: 'state', subject: 'fake' },
  ])('잘못된 입력은 외부 호출 전에 400이다', async (body) => {
    await post('/auth/social/login', body).expect(400);
    expect(http).not.toHaveBeenCalled();
    expect(users.findBySocialAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('시작 URL과 앱 반환에 비밀값·code·state를 노출하지 않는다', async () => {
    const start = await startLogin();
    expect(start.expiresIn).toBe(300);
    expect(start.attemptSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(
      new URL(start.authorizationUrl).searchParams.get('redirect_uri'),
    ).toBe('https://later.hoe.pe.kr/auth/social/naver/callback');
    expect(start.authorizationUrl).not.toContain(start.attemptSecret);
    const result = await callback(currentState).expect(303);
    expect(result.headers.location).toBe(
      'later://auth/naver?loginAttemptId=' + start.loginAttemptId,
    );
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers['referrer-policy']).toBe('no-referrer');
    const complete = await post('/auth/social/login', {
      provider: 'naver',
      loginAttemptId: start.loginAttemptId,
      attemptSecret: start.attemptSecret,
    }).expect(200);
    expect(complete.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Connection', 'keep-alive')
      .set('Authorization', 'Bearer ' + complete.body.accessToken)
      .expect(200);
  });
  it('불일치·대기·재사용을 거부한다', async () => {
    const start = await startLogin();
    const body = {
      provider: 'naver',
      loginAttemptId: start.loginAttemptId,
      attemptSecret: start.attemptSecret,
    };
    await callback('unknown').expect(401);
    await post('/auth/social/login', body).expect(401);
    await callback(currentState).expect(303);
    await post('/auth/social/login', {
      ...body,
      attemptSecret: 'x'.repeat(43),
    }).expect(401);
    expect(http).not.toHaveBeenCalled();
    await post('/auth/social/login', body).expect(200);
    await post('/auth/social/login', body).expect(401);
    await callback(currentState).expect(401);
    expect(http).toHaveBeenCalledTimes(2);
  });
  it('취소와 만료는 로그인 실패이다', async () => {
    const start = await startLogin();
    await callback(currentState, {
      error: 'access_denied',
      error_description: 'cancelled',
    }).expect(303);
    await post('/auth/social/login', {
      provider: 'naver',
      loginAttemptId: start.loginAttemptId,
      attemptSecret: start.attemptSecret,
    }).expect(401);
    const expired = await startLogin();
    rows.get(expired.loginAttemptId)!.expiresAt = new Date(0);
    await callback(currentState).expect(401);
    expect(http).not.toHaveBeenCalled();
  });
  it.each(['credential', 'state', 'code'])(
    '네이버 시도와 %s 혼합을 거부한다',
    async (key) => {
      await post('/auth/social/login', {
        provider: 'naver',
        loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
        attemptSecret: 'x'.repeat(43),
        [key]: 'injected',
      }).expect(400);
      expect(http).not.toHaveBeenCalled();
    },
  );
  it('전용 완료 경로는 제거한다', async () => {
    await post('/auth/social/naver/complete', {}).expect(404);
  });
  it('입력과 설정 오류를 구분한다', async () => {
    await post('/auth/social/naver/start', { extra: 'field' }).expect(400);
    for (const body of [
      {},
      {
        provider: 'naver',
        loginAttemptId: 'invalid',
        attemptSecret: 'x'.repeat(43),
      },
      {
        provider: 'naver',
        loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
        attemptSecret: 'short',
      },
      {
        provider: 'naver',
        loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
        attemptSecret: 'x'.repeat(43),
        code: 'injected',
      },
    ])
      await post('/auth/social/login', body).expect(400);
    for (const query of [
      {},
      { state: 'valid', code: '' },
      { state: ['a', 'b'], code: 'code' },
      { state: 'valid', code: 'code', error: 'access_denied' },
      { state: 'valid' },
    ])
      await request(app.getHttpServer())
        .get('/auth/social/naver/callback')
        .set('Connection', 'keep-alive')
        .query(query)
        .expect(400);
    const key = process.env.NAVER_LOGIN_BRIDGE_KEY;
    vi.stubEnv('NAVER_LOGIN_BRIDGE_KEY', '');
    try {
      const response = await post('/auth/social/naver/start').expect(503);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    } finally {
      vi.stubEnv('NAVER_LOGIN_BRIDGE_KEY', key);
    }
    expect(http).not.toHaveBeenCalled();
  });
});
