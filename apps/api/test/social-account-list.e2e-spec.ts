import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';
import { Test } from '@nestjs/testing';
import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from '@auth/application/ports/access-token.js';
import { setupOpenApi } from '../src/common/openapi/setup-openapi.js';

describe('소셜 계정 목록 HTTP', () => {
  let app: INestApplication<App>;
  let token: string;
  const userId = '03a6a909-2640-4e3e-a608-59056761083d';
  const linkedAt = new Date('2026-10-03T00:00:00Z');
  const findMany = vi
    .fn()
    .mockResolvedValue([
      { id: 'account', provider: 'naver', createdAt: linkedAt },
    ]);
  beforeAll(async () => {
    for (const [key, value] of Object.entries({
      GOOGLE_CLIENT_ID: 'test',
      KAKAO_APP_ID: '1234',
      NAVER_CLIENT_ID: 'test',
      NAVER_CLIENT_SECRET: 'test',
      APPLE_CLIENT_IDS: 'test',
      ACCESS_TOKEN_SECRET: 'test-only-social-list-secret-more-than-32-bytes',
    }))
      vi.stubEnv(key, value);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(new TestAuthRateLimitRepository())
      .overrideProvider(PrismaClient)
      .useValue({
        $connect: async () => {},
        $disconnect: async () => {},
        user: { findUnique: async () => ({ id: userId }) },
        socialAccount: { findMany },
      })
      .compile();
    app = module.createNestApplication();
    setupOpenApi(app);
    await app.init();
    token = (
      await module.get<AccessTokenIssuer>(ACCESS_TOKEN_ISSUER).issue(userId)
    ).accessToken;
  });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });
  it('JWT 본인의 목록만 반환하고 subject/토큰을 노출하지 않는다', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/me/social-accounts')
      .set('Connection', 'keep-alive')
      .set('Authorization', `Bearer ${token}`)
      .query({ userId: 'attacker' })
      .expect(200);
    expect(response.body).toEqual({
      socialAccounts: [
        { id: 'account', provider: 'naver', linkedAt: linkedAt.toISOString() },
      ],
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(findMany).toHaveBeenCalledWith({
      where: { userId },
      select: { id: true, provider: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });
  it('인증 없이 목록을 조회할 수 없다', async () => {
    await request(app.getHttpServer())
      .get('/users/me/social-accounts')
      .set('Connection', 'keep-alive')
      .expect(401);
  });
  it('OpenAPI에 목록 응답과 Bearer 계약을 제공한다', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/docs-json')
      .set('Connection', 'keep-alive')
      .expect(200);
    const operation = body.paths['/users/me/social-accounts'].get;
    expect(operation.security).toEqual([{ bearer: [] }]);
    expect(
      operation.responses['200'].content['application/json'].schema.$ref,
    ).toContain('SocialAccountList');
  });
  it('목록 저장소 장애는 내부 내용을 숨긴500을 반환한다', async () => {
    findMany.mockRejectedValueOnce(new Error('private-account-error'));
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      const response = await request(app.getHttpServer())
        .get('/users/me/social-accounts')
        .set('Connection', 'keep-alive')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.text).not.toContain('private-account-error');
    } finally {
      log.mockRestore();
    }
  });
});
