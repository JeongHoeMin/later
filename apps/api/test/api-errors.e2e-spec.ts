import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Logger,
  Param,
  ParseIntPipe,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';

@Controller('error-fixture')
class ErrorFixtureController {
  @Get('bad-request')
  badRequest() {
    throw new BadRequestException('잘못된 요청입니다.');
  }

  @Get('custom-code')
  customCode() {
    throw new UnauthorizedException({
      code: 'SOCIAL_AUTHENTICATION_FAILED',
      message: '소셜 인증에 실패했습니다.',
    });
  }

  @Get('string')
  stringError() {
    throw new HttpException('접근할 수 없습니다.', 403);
  }

  @Get('validation')
  validation() {
    throw new BadRequestException({
      message: ['provider must be a string', 'credential should not be empty'],
    });
  }

  @Get('number/:id')
  number(@Param('id', ParseIntPipe) id: number) {
    return { id };
  }

  @Get('unexpected')
  unexpected() {
    throw new Error('database password=secret');
  }

  @Get('internal')
  internal() {
    throw new InternalServerErrorException('database password=secret');
  }
}

describe('공통 오류 응답 (e2e)', () => {
  let app: INestApplication<App>;
  const logError = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});

  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'e2e-client.apps.googleusercontent.com');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-only-access-secret-with-at-least-32-bytes',
    );
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ErrorFixtureController],
    })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      logError.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  function get(path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Connection', 'keep-alive');
  }

  it('기본 HTTP 오류를 공통 형식으로 반환한다', async () => {
    const response = await get('/error-fixture/bad-request').expect(400);
    expect(response.body).toEqual({
      error: { code: 'BAD_REQUEST', message: '잘못된 요청입니다.' },
    });
  });

  it('HTTP 경계에서 지정한 오류 코드를 유지한다', async () => {
    const response = await get('/error-fixture/custom-code').expect(401);
    expect(response.body).toEqual({
      error: {
        code: 'SOCIAL_AUTHENTICATION_FAILED',
        message: '소셜 인증에 실패했습니다.',
      },
    });
  });

  it('문자열 HttpException도 동일한 형식으로 반환한다', async () => {
    const response = await get('/error-fixture/string').expect(403);
    expect(response.body).toEqual({
      error: { code: 'FORBIDDEN', message: '접근할 수 없습니다.' },
    });
  });

  it('검증 메시지 목록을 details에 반환한다', async () => {
    const response = await get('/error-fixture/validation').expect(400);
    expect(response.body).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: '요청 값이 올바르지 않습니다.',
        details: [
          'provider must be a string',
          'credential should not be empty',
        ],
      },
    });
  });

  it('파이프에서 발생한 오류에도 전역 필터가 적용된다', async () => {
    const response = await get('/error-fixture/number/not-a-number').expect(
      400,
    );
    expect(response.body).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Validation failed (numeric string is expected)',
      },
    });
  });

  it('존재하지 않는 경로에도 전역 필터가 적용된다', async () => {
    const response = await get('/missing').expect(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Cannot GET /missing' },
    });
  });

  it.each(['unexpected', 'internal'])(
    '%s 오류는 내부 내용을 숨기고 서버에 기록한다',
    async (path) => {
      logError.mockClear();
      const response = await get(`/error-fixture/${path}`).expect(500);
      expect(response.body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
        },
      });
      expect(logError).toHaveBeenCalled();
    },
  );

  it('성공 응답은 그대로 유지한다', async () => {
    const response = await get('/error-fixture/number/42').expect(200);
    expect(response.body).toEqual({ id: 42 });
  });
});
