import {
  Controller,
  Get,
  Logger,
  Req,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccessTokenModule } from '@auth/access-token.module.js';
import {
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenIssuer,
} from '@auth/application/ports/access-token.js';
import {
  AccessTokenGuard,
  type AuthenticatedRequest,
} from '@auth/presentation/http/access-token.guard.js';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';

@Controller('guard-fixture')
class GuardFixtureController {
  @Get('protected')
  @UseGuards(AccessTokenGuard)
  protected(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Get('public')
  publicRoute() {
    return { public: true };
  }
}

const secret = 'test-only-access-secret-with-at-least-32-bytes';

describe('AccessTokenGuard (e2e)', () => {
  let app: INestApplication<App>;
  let issuer: AccessTokenIssuer;

  beforeAll(async () => {
    vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
    const module = await Test.createTestingModule({
      imports: [AccessTokenModule],
      controllers: [GuardFixtureController],
      providers: [
        {
          provide: APP_FILTER,
          inject: [HttpAdapterHost],
          useFactory: (host: HttpAdapterHost) => new ApiExceptionFilter(host),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    issuer = module.get<AccessTokenIssuer>(ACCESS_TOKEN_ISSUER);
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  function get(path = '/guard-fixture/protected') {
    return request(app.getHttpServer())
      .get(path)
      .set('Connection', 'keep-alive');
  }

  it('발급된 토큰으로 보호 경로에 접근하면 인증된 회원을 전달한다', async () => {
    const token = await issuer.issue('user-123');
    const response = await get()
      .set('Authorization', `Bearer ${token.accessToken}`)
      .expect(200);
    expect(response.body).toEqual({ userId: 'user-123' });
  });

  it('인증 스킴은 대소문자를 구분하지 않는다', async () => {
    const token = await issuer.issue('user-123');
    const response = await get()
      .set('Authorization', `bearer ${token.accessToken}`)
      .expect(200);
    expect(response.body).toEqual({ userId: 'user-123' });
  });

  it.each([
    undefined,
    'Basic token',
    'Bearer',
    'Bearer one two',
    'Bearer one,two',
  ])('잘못된 헤더 %j는 401을 반환한다', async (header) => {
    const call = get();
    if (header !== undefined) call.set('Authorization', header);
    const response = await call.expect(401);
    expect(response.body).toEqual({
      error: { code: 'AUTHENTICATION_REQUIRED', message: '인증이 필요합니다.' },
    });
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it('잘못된 토큰은 공통 401 응답으로 변환한다', async () => {
    const response = await get()
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_ACCESS_TOKEN',
        message: '유효하지 않은 Access Token입니다.',
      },
    });
  });

  it('만료된 토큰은 보호 경로에서 거부한다', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
      .setSubject('user-123')
      .setIssuer('later-api')
      .setAudience('later-mobile')
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(new TextEncoder().encode(secret));
    const response = await get()
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('Guard를 적용하지 않은 경로는 인증 없이 접근한다', async () => {
    const response = await get('/guard-fixture/public').expect(200);
    expect(response.body).toEqual({ public: true });
  });
});

describe('AccessTokenGuard 시스템 오류 (e2e)', () => {
  it('검증 시스템 오류는 인증 실패로 숨기지 않고 500으로 전달한다', async () => {
    vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    let app: INestApplication<App> | undefined;
    try {
      const module = await Test.createTestingModule({
        imports: [AccessTokenModule],
        controllers: [GuardFixtureController],
        providers: [
          {
            provide: APP_FILTER,
            inject: [HttpAdapterHost],
            useFactory: (host: HttpAdapterHost) => new ApiExceptionFilter(host),
          },
        ],
      })
        .overrideProvider(ACCESS_TOKEN_VERIFIER)
        .useValue({
          verify: vi.fn().mockRejectedValue(new Error('private error')),
        })
        .compile();
      app = module.createNestApplication();
      await app.init();
      const response = await request(app.getHttpServer())
        .get('/guard-fixture/protected')
        .set('Connection', 'keep-alive')
        .set('Authorization', 'Bearer token')
        .expect(500);
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
        },
      });
    } finally {
      await app?.close();
      log.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
