import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import { vi } from 'vitest';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'e2e-client.apps.googleusercontent.com');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-naver-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-naver-secret');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-only-access-secret-with-at-least-32-bytes',
    );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(new TestAuthRateLimitRepository())
      .overrideProvider(PrismaClient)
      .useValue({
        $connect: async () => {},
        $disconnect: async () => {},
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return (
      request(app.getHttpServer())
        .get('/')
        // Avoid intermittent connection resets when Windows closes the response socket.
        .set('Connection', 'keep-alive')
        .expect(200)
        .expect('Hello World!')
    );
  });

  afterEach(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
