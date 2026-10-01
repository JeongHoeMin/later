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
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-only-access-secret-with-at-least-32-bytes',
    );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
