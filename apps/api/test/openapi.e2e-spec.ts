import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import { setupOpenApi } from '../src/common/openapi/setup-openapi.js';

@Controller('documentation-test')
class DocumentationTestController {
  @Get()
  read() {
    return 'test';
  }
}

describe('OpenAPI 조회 (e2e)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'private-test-secret');
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'private-test-access-secret-with-at-least-32-bytes',
    );
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [DocumentationTestController],
    })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .compile();
    app = module.createNestApplication();
    setupOpenApi(app);
    await app.init();
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('GET으로 현재 앱의 OpenAPI JSON을 인증 없이 조회한다', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .set('Connection', 'keep-alive')
      .expect(200)
      .expect('Content-Type', /json/);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.info).toMatchObject({
      title: 'Later API',
      version: '1.0.0',
    });
    for (const path of [
      '/',
      '/auth/social/login',
      '/auth/social/apple/start',
      '/auth/token/refresh',
      '/auth/logout',
      '/documentation-test',
    ])
      expect(response.body.paths).toHaveProperty(path);
    expect(response.body.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(response.text).not.toContain('private-test-secret');
    expect(response.text).not.toContain('private-test-access-secret');
  });
  it('GET으로 Swagger UI를 읽는다', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs')
      .set('Connection', 'keep-alive')
      .expect(200)
      .expect('Content-Type', /html/);
    expect(response.text).toContain('swagger-ui');
  });
});
