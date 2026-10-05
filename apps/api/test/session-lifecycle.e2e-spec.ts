import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';
import { USER_ACCOUNT_REPOSITORY } from '@users/application/ports/user-account.repository.js';
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
import { REFRESH_SESSION_REPOSITORY } from '@auth/application/ports/refresh-session.repository.js';
import { SecureRefreshTokenGenerator } from '@auth/infrastructure/tokens/secure-refresh-token-generator.js';

const rateLimits = new TestAuthRateLimitRepository();

describe('세션 갱신과 로그아웃 (e2e)', () => {
  let app: INestApplication<App>;
  const tokens = new SecureRefreshTokenGenerator();
  const original = tokens.generate();
  const secret = 'test-only-secret-with-at-least-32-bytes';
  const sessions = {
    findUserId: vi.fn(),
    rotate: vi.fn(),
    revokeByHash: vi.fn(),
  };
  const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-naver-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-naver-secret');
    vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_ACCOUNT_REPOSITORY)
      .useValue({ exists: async () => true })
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(rateLimits)
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .overrideProvider(REFRESH_SESSION_REPOSITORY)
      .useValue(sessions)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    rateLimits.buckets.clear();
    sessions.findUserId.mockReset().mockResolvedValue('verified-user');
    sessions.rotate.mockReset().mockResolvedValue('rotated');
    sessions.revokeByHash.mockReset().mockResolvedValue(undefined);
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
      log.mockRestore();
    }
  });
  function post(path: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post(path)
      .set('Connection', 'keep-alive')
      .send(body);
  }

  it('갱신 성공 시 회원 ID에 대한 새 토큰 쌍을 반환한다', async () => {
    const response = await post('/auth/token/refresh', {
      refreshToken: original.token,
    }).expect(200);
    expect(response.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(response.body.refreshToken).not.toBe(original.token);
    const member = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Connection', 'keep-alive')
      .set('Authorization', `Bearer ${response.body.accessToken}`)
      .expect(200);
    expect(member.body).toEqual({ user: { id: 'verified-user' } });
    expect(
      (
        await jwtVerify(
          response.body.accessToken,
          new TextEncoder().encode(secret),
          { issuer: 'later-api', audience: 'later-mobile' },
        )
      ).payload.sub,
    ).toBe('verified-user');
    expect(sessions.rotate).toHaveBeenCalledExactlyOnceWith(
      original.hash,
      tokens.hash(response.body.refreshToken),
      expect.any(Date),
    );
  });

  it.each(['invalid', 'reused'])(
    '교체 결과 %s는 공통 401을 반환한다',
    async (result) => {
      sessions.rotate.mockResolvedValue(result);
      const response = await post('/auth/token/refresh', {
        refreshToken: original.token,
      }).expect(401);
      expect(response.body).toEqual({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: '유효하지 않은 Refresh Token입니다.',
        },
      });
    },
  );

  it('알 수 없는 토큰은 401을 반환한다', async () => {
    sessions.findUserId.mockResolvedValue(null);
    const response = await post('/auth/token/refresh', {
      refreshToken: original.token,
    }).expect(401);
    expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    expect(sessions.rotate).not.toHaveBeenCalled();
  });

  it.each(['/auth/token/refresh', '/auth/logout'])(
    '잘못된 %s 요청은 400이며 저장소를 호출하지 않는다',
    async (path) => {
      const response = await post(path, {
        refreshToken: 'token',
        userId: 'untrusted',
      }).expect(400);
      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(sessions.findUserId).not.toHaveBeenCalled();
      expect(sessions.rotate).not.toHaveBeenCalled();
      expect(sessions.revokeByHash).not.toHaveBeenCalled();
    },
  );

  it('로그아웃은 세션을 폐기하고 빈 204를 반환한다', async () => {
    const response = await post('/auth/logout', {
      refreshToken: original.token,
    }).expect(204);
    expect(response.text).toBe('');
    expect(sessions.revokeByHash).toHaveBeenCalledExactlyOnceWith(
      original.hash,
      expect.any(Date),
    );
  });

  it('DB 오류는 토큰을 포함하지 않은 공통 500으로 처리한다', async () => {
    sessions.rotate.mockRejectedValue(new Error('private DB error'));
    const response = await post('/auth/token/refresh', {
      refreshToken: original.token,
    }).expect(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류가 발생했습니다.',
      },
    });
  });
});
