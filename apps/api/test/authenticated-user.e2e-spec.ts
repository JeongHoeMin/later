import { USER_ACCOUNT_REPOSITORY } from '@users/application/ports/user-account.repository.js';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import {
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenIssuer,
  type AccessTokenVerifier,
} from '@auth/application/ports/access-token.js';
import { setupOpenApi } from '../src/common/openapi/setup-openapi.js';

const secret = 'test-only-me-access-secret-with-at-least-32-bytes';
const userId = '2f3a7e1d-8017-48a7-8fbe-e4115f9c922f';

describe('GET /auth/me (e2e)', () => {
  let app: INestApplication<App>;
  let issuer: AccessTokenIssuer;
  let verifier: AccessTokenVerifier;
  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-secret');
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_ACCOUNT_REPOSITORY)
      .useValue({ exists: async () => true })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .compile();
    app = module.createNestApplication();
    setupOpenApi(app);
    await app.init();
    issuer = module.get<AccessTokenIssuer>(ACCESS_TOKEN_ISSUER);
    verifier = module.get<AccessTokenVerifier>(ACCESS_TOKEN_VERIFIER);
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  function me() {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Connection', 'keep-alive');
  }

  it('발급한 서비스 JWT의 회원ID만 반환하고 캐시하지 않는다', async () => {
    const token = await issuer.issue(userId);
    const response = await me()
      .query({ userId: 'attacker', subject: 'attacker' })
      .set('Authorization', `Bearer ${token.accessToken}`)
      .expect(200);
    expect(response.body).toEqual({ user: { id: userId } });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).not.toContain(token.accessToken);
  });
  it.each([undefined, 'Basic token', 'Bearer one two'])(
    '잘못된 헤더 %j는 인증을 요구한다',
    async (header) => {
      const call = me();
      if (header) call.set('Authorization', header);
      const response = await call.expect(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      expect(response.headers['www-authenticate']).toBe('Bearer');
    },
  );
  it('제공자 토큰이나 잘못된 서비스 토큰은 거부한다', async () => {
    const response = await me()
      .set('Authorization', 'Bearer provider-token')
      .expect(401);
    expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });
  it('만료된 서비스 JWT는 거부한다', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
      .setSubject(userId)
      .setIssuer('later-api')
      .setAudience('later-mobile')
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(new TextEncoder().encode(secret));
    const response = await me()
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });
  it('검증 시스템 오류는 원문을 숨긴500으로 반환한다', async () => {
    const spy = vi
      .spyOn(verifier, 'verify')
      .mockRejectedValueOnce(new Error('private-error'));
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      const response = await me()
        .set('Authorization', 'Bearer token')
        .expect(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.text).not.toContain('private-error');
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
  });
  it('OpenAPI에 회원응답과 서비스Bearer 인증계약을 제공한다', async () => {
    const { body: doc } = await request(app.getHttpServer())
      .get('/docs-json')
      .set('Connection', 'keep-alive')
      .expect(200);
    const operation = doc.paths['/auth/me']?.get;
    expect(operation).toBeDefined();
    expect(operation.security).toEqual([{ bearer: [] }]);
    expect(operation.requestBody).toBeUndefined();
    for (const status of ['200', '401', '500'])
      expect(operation.responses[status]).toBeDefined();
    const ref = operation.responses['200'].content[
      'application/json'
    ].schema.$ref
      .split('/')
      .pop();
    expect(doc.components.schemas[ref].required).toEqual(['user']);
    expect(doc.components.schemas[ref].properties.user.$ref).toContain(
      'SocialUserResponseDto',
    );
  });
});
