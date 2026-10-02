import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { exportJWK, generateKeyPair, SignJWT, jwtVerify } from 'jose';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import { SOCIAL_USER_REPOSITORY } from '@users/application/ports/social-user.repository.js';
import { AUTH_SESSION_REPOSITORY } from '@auth/application/ports/auth-session.repository.js';
import { APPLE_LOGIN_ATTEMPT_REPOSITORY } from '@auth/application/ports/apple-login-attempt.repository.js';

describe('Apple 소셜 로그인 (e2e)', () => {
  let app: INestApplication<App>;
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  let publicKey: Record<string, unknown>;
  let log: ReturnType<typeof vi.spyOn>;
  const http = vi.fn<typeof fetch>();
  const users = {
    findBySocialAccount: vi.fn(),
    createWithSocialAccount: vi.fn(),
  };
  const sessions = { create: vi.fn() };
  const stored = new Map<
    string,
    { nonceHash: string; expiresAt: Date; used: boolean }
  >();
  const attempts = {
    create: vi.fn(
      async (attempt: { id: string; nonceHash: string; expiresAt: Date }) => {
        stored.set(attempt.id, { ...attempt, used: false });
      },
    ),
    consume: vi.fn(async (id: string, nonceHash: string, now: Date) => {
      const value = stored.get(id);
      if (
        !value ||
        value.used ||
        value.nonceHash !== nonceHash ||
        value.expiresAt <= now
      )
        return false;
      value.used = true;
      return true;
    }),
  };
  const secret = 'test-only-access-secret-with-at-least-32-bytes';
  beforeAll(async () => {
    keys = await generateKeyPair('RS256');
    publicKey = {
      ...(await exportJWK(keys.publicKey)),
      kid: 'apple-e2e',
      alg: 'RS256',
      use: 'sig',
    };
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-secret');
    vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
    vi.stubGlobal('fetch', http);
    log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(SOCIAL_USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(AUTH_SESSION_REPOSITORY)
      .useValue(sessions)
      .overrideProvider(APPLE_LOGIN_ATTEMPT_REPOSITORY)
      .useValue(attempts)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    stored.clear();
    attempts.create.mockClear();
    attempts.consume.mockClear();
    http
      .mockReset()
      .mockImplementation(async () => Response.json({ keys: [publicKey] }));
    users.findBySocialAccount
      .mockReset()
      .mockResolvedValue({ id: 'existing-apple-user' });
    users.createWithSocialAccount
      .mockReset()
      .mockResolvedValue({ id: 'new-apple-user' });
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
  function start() {
    return request(app.getHttpServer())
      .post('/auth/social/apple/start')
      .set('Connection', 'keep-alive');
  }
  function login(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/auth/social/login')
      .set('Connection', 'keep-alive')
      .send(body);
  }
  function token(nonce: string, claims: Record<string, unknown> = {}) {
    return new SignJWT({
      iss: 'https://appleid.apple.com',
      aud: 'com.later.test',
      sub: 'apple-subject',
      nonce,
      exp: Math.floor(Date.now() / 1000) + 300,
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'apple-e2e' })
      .sign(keys.privateKey);
  }
  function noSession() {
    expect(users.findBySocialAccount).not.toHaveBeenCalled();
    expect(users.createWithSocialAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  }
  // Runs first with no cached JWKS so the actual adapter's outage path is exercised.
  it('Apple 공개 키 장애는 원문 없이 503이고 시도를 소비하지 않는다', async () => {
    const attempt = (await start().expect(201)).body;
    http.mockImplementation(async () =>
      Response.json({ error: 'private token' }, { status: 503 }),
    );
    const response = await login({
      provider: 'apple',
      credential: await token(attempt.nonce),
      loginAttemptId: attempt.loginAttemptId,
    }).expect(503);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(response.text).not.toContain('private token');
    expect(attempts.consume).not.toHaveBeenCalled();
    noSession();
  });
  it('시작 API는 무작위 nonce와 5분 유효기간을 반환하고 외부 호출하지 않는다', async () => {
    const first = (await start().expect(201)).body;
    const second = (await start().expect(201)).body;
    expect(first).toEqual({
      loginAttemptId: expect.any(String),
      nonce: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expiresIn: 300,
    });
    expect(second.nonce).not.toBe(first.nonce);
    expect(http).not.toHaveBeenCalled();
    expect(stored.get(first.loginAttemptId)).not.toHaveProperty('nonce');
  });
  it('시작 API는 추가 입력을 거부한다', async () => {
    await start().send({ nonce: 'attacker-input' }).expect(400);
    expect(attempts.create).not.toHaveBeenCalled();
  });
  it.each(['existing', 'new'])(
    '%s Apple 회원에게 서비스 토큰을 발급한다',
    async (kind) => {
      if (kind === 'new') users.findBySocialAccount.mockResolvedValue(null);
      const attempt = (await start().expect(201)).body;
      const response = await login({
        provider: 'apple',
        credential: await token(attempt.nonce),
        loginAttemptId: attempt.loginAttemptId,
      }).expect(200);
      const userId = kind === 'new' ? 'new-apple-user' : 'existing-apple-user';
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
        provider: 'apple',
        subject: 'apple-subject',
      });
      expect(sessions.create).toHaveBeenCalledOnce();
      if (kind === 'new')
        expect(users.createWithSocialAccount).toHaveBeenCalledExactlyOnceWith({
          provider: 'apple',
          subject: 'apple-subject',
        });
      else expect(users.createWithSocialAccount).not.toHaveBeenCalled();
    },
  );
  it.each(['mismatch', 'expired', 'missing'])(
    '시도 %s는 회원과 세션 없이 401이다',
    async (kind) => {
      const attempt = (await start().expect(201)).body;
      if (kind === 'expired')
        stored.get(attempt.loginAttemptId)!.expiresAt = new Date(0);
      const credential = await token(
        kind === 'mismatch' ? 'another-nonce' : attempt.nonce,
      );
      const response = await login({
        provider: 'apple',
        credential,
        loginAttemptId:
          kind === 'missing' ? randomUUID() : attempt.loginAttemptId,
      }).expect(401);
      expect(response.body.error.code).toBe('SOCIAL_AUTHENTICATION_FAILED');
      expect(response.text).not.toContain(credential);
      noSession();
    },
  );
  it('같은 로그인 시도를 다시 사용하면 회원을 조회하지 않는다', async () => {
    const attempt = (await start().expect(201)).body;
    const body = {
      provider: 'apple',
      credential: await token(attempt.nonce),
      loginAttemptId: attempt.loginAttemptId,
    };
    await login(body).expect(200);
    users.findBySocialAccount.mockClear();
    sessions.create.mockClear();
    await login(body).expect(401);
    noSession();
  });
  it('서명된 다른 앱 토큰도 시도를 소비하지 않는다', async () => {
    const attempt = (await start().expect(201)).body;
    await login({
      provider: 'apple',
      credential: await token(attempt.nonce, { aud: 'another-app' }),
      loginAttemptId: attempt.loginAttemptId,
    }).expect(401);
    expect(attempts.consume).not.toHaveBeenCalled();
    noSession();
  });
  it.each([
    { provider: 'apple', credential: 'token' },
    { provider: 'apple', credential: 'token', loginAttemptId: 'invalid' },
    {
      provider: 'apple',
      credential: 'token',
      loginAttemptId: randomUUID(),
      nonce: 'fake',
    },
  ])('잘못된 Apple 입력은 외부 호출 전에 400이다', async (body) => {
    await login(body).expect(400);
    expect(http).not.toHaveBeenCalled();
    expect(attempts.consume).not.toHaveBeenCalled();
    noSession();
  });
});
