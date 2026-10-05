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
import { setupOpenApi } from '../src/common/openapi/setup-openapi.js';

const member = '03a6a909-2640-4e3e-a608-59056761083d';
describe('회원 탈퇴 HTTP', () => {
  let app: INestApplication<App>;
  let issuer: AccessTokenIssuer;
  let token: string;
  const members = new Set<string>();
  const findUnique = vi.fn(async ({ where }: { where: { id: string } }) =>
    members.has(where.id) ? { id: where.id } : null,
  );
  const deleteMany = vi.fn(async ({ where }: { where: { id: string } }) => ({
    count: Number(members.delete(where.id)),
  }));
  beforeAll(async () => {
    for (const [key, value] of Object.entries({
      GOOGLE_CLIENT_ID: 'test',
      KAKAO_APP_ID: '1234',
      NAVER_CLIENT_ID: 'test',
      NAVER_CLIENT_SECRET: 'test',
      APPLE_CLIENT_IDS: 'test',
      ACCESS_TOKEN_SECRET: 'test-only-withdrawal-secret-more-than-32-bytes',
    }))
      vi.stubEnv(key, value);
    const prisma = {
      $connect: async () => {},
      $disconnect: async () => {},
      user: { findUnique, deleteMany },
      $transaction: async (operation: (client: unknown) => unknown) =>
        operation(prisma),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(new TestAuthRateLimitRepository())
      .overrideProvider(PrismaClient)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    setupOpenApi(app);
    await app.init();
    issuer = module.get(ACCESS_TOKEN_ISSUER);
    token = (await issuer.issue(member)).accessToken;
  });
  beforeEach(() => {
    members.clear();
    members.add(member);
    deleteMany.mockClear();
  });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });
  const call = (method: 'get' | 'delete', path: string, bearer = token) =>
    request(app.getHttpServer())
      [method](path)
      .set('Connection', 'keep-alive')
      .set('Authorization', `Bearer ${bearer}`);
  it('본인을 삭제한 뒤 같은 JWT와 다른 기기 JWT를 즉시 거부한다', async () => {
    const otherDevice = (await issuer.issue(member)).accessToken;
    const response = await call('delete', '/users/me')
      .query({ userId: 'another-member' })
      .expect(204);
    expect(response.text).toBe('');
    expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: member },
    });
    for (const bearer of [token, otherDevice]) {
      const denied = await call('get', '/auth/me', bearer).expect(401);
      expect(denied.body.error.code).toBe('INVALID_ACCESS_TOKEN');
    }
  });
  it('삭제된 회원의 기존 JWT는 탈퇴 API도 거부한다', async () => {
    members.delete(member);
    await call('get', '/auth/me').expect(401);
    await call('delete', '/users/me').expect(401);
    expect(deleteMany).not.toHaveBeenCalled();
  });
  it('인증되지 않은 탈퇴는 계정을 삭제하지 않는다', async () => {
    await request(app.getHttpServer())
      .delete('/users/me')
      .set('Connection', 'keep-alive')
      .expect(401);
    expect(deleteMany).not.toHaveBeenCalled();
  });
  it('탈퇴 OpenAPI는 Bearer와 204/401/500을 제공한다', async () => {
    const { body } = await call('get', '/docs-json').expect(200);
    const operation = body.paths['/users/me'].delete;
    expect(operation.security).toEqual([{ bearer: [] }]);
    for (const status of ['204', '401', '500'])
      expect(operation.responses[status]).toBeDefined();
  });
  it('회원 존재 조회 장애는500으로 닫고 계정을 삭제하지 않는다', async () => {
    findUnique.mockRejectedValueOnce(new Error('private-db-error'));
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      const response = await call('delete', '/users/me').expect(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.text).not.toContain('private-db-error');
      expect(deleteMany).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
