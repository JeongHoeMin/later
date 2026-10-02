import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { Response } from 'express';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import { get as httpGet } from 'node:http';

let notifyConnectionClosed: (() => void) | undefined;

@Controller('logging-test')
class LoggingTestController {
  @Get('hold') hold(@Res() response: Response) {
    response.once('close', () => notifyConnectionClosed?.());
    response.flushHeaders();
  }
  @Get() read() {
    return { token: 'private-response' };
  }
  @Post() create(@Body() body: unknown) {
    return body;
  }
  @Post('empty') @HttpCode(204) empty() {}
  @Get('redirect') redirect(@Res() response: Response) {
    response.redirect(303, '/private-target?code=secret');
  }
  @Get('bad') bad() {
    throw new BadRequestException('private-error');
  }
  @Get('unauthorized') unauthorized() {
    throw new UnauthorizedException('private-error');
  }
  @Get('unavailable') unavailable() {
    throw new ServiceUnavailableException('private-error');
  }
  @Get('error') error() {
    throw new Error('private-token-in-stack');
  }
}

describe('전역 Controller 로깅', () => {
  let app: INestApplication<App>;
  let log: ReturnType<typeof vi.spyOn>,
    warn: ReturnType<typeof vi.spyOn>,
    error: ReturnType<typeof vi.spyOn>;
  beforeAll(async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-secret');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-access-secret-at-least-thirty-two-bytes',
    );
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [LoggingTestController],
    })
      .overrideProvider(PrismaClient)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .compile();
    app = module.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  beforeEach(() => {
    log.mockClear();
    warn.mockClear();
    error.mockClear();
  });
  afterAll(async () => {
    await app?.close();
    log?.mockRestore();
    warn?.mockRestore();
    error?.mockRestore();
    vi.unstubAllEnvs();
  });
  it.each([
    ['', 'GET', 200],
    ['', 'POST', 201],
    ['/empty', 'POST', 204],
    ['/redirect', 'GET', 303],
    ['/bad', 'GET', 400],
    ['/unauthorized', 'GET', 401],
    ['/unavailable', 'GET', 503],
    ['/error', 'GET', 500],
  ])('%s %s %i의 진입과 실제 종료를 기록한다', async (path, method, status) => {
    const agent = request(app.getHttpServer());
    const call =
      method === 'POST'
        ? agent
            .post('/logging-test' + path)
            .send({ credential: 'private-request' })
        : agent.get('/logging-test' + path);
    const result = await call
      .set('Connection', 'keep-alive')
      .set('Authorization', 'Bearer private-header')
      .query({ state: 'private-query' })
      .expect(status as number);
    const records = [...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]
      .map((c) => c[0])
      .filter((v) => v && typeof v === 'object' && 'event' in v);
    const entry = records.find((v) => v.event === 'request.started');
    const ending = records.filter((v) =>
      ['request.succeeded', 'request.failed'].includes(v.event),
    );
    expect(entry).toMatchObject({
      requestId: result.headers['x-request-id'],
      method,
      controller: 'LoggingTestController',
      handler: expect.any(String),
    });
    expect(result.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(ending).toHaveLength(1);
    expect(ending[0]).toMatchObject({
      event: (status as number) >= 400 ? 'request.failed' : 'request.succeeded',
      requestId: entry.requestId,
      statusCode: status,
      durationMs: expect.any(Number),
    });
    expect(ending[0].durationMs).toBeGreaterThanOrEqual(0);
    if (path === '' && method === 'GET')
      expect(result.body).toEqual({ token: 'private-response' });
    if (path === '' && method === 'POST')
      expect(result.body).toEqual({ credential: 'private-request' });
    if (status === 204) expect(result.text).toBe('');
    if (status === 303)
      expect(result.headers.location).toBe('/private-target?code=secret');
    if ((status as number) >= 500)
      expect(result.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    const captured = JSON.stringify([
      ...log.mock.calls,
      ...warn.mock.calls,
      ...error.mock.calls,
    ]);
    expect(captured).not.toMatch(/private-|secret|credential|Authorization/);
  });
  it('연결 중단은 실패 로그 하나를 남긴다', async () => {
    const closed = new Promise<void>((resolve) => {
      notifyConnectionClosed = resolve;
    });
    const client = httpGet(
      (await app.getUrl()) + '/logging-test/hold',
      (response) => {
        response.on('error', () => {});
        response.destroy();
      },
    );
    client.on('error', () => {});
    try {
      await closed;
      expect(warn.mock.calls.map((call: unknown[]) => call[0])).toEqual([
        expect.objectContaining({
          event: 'request.failed',
          reason: 'connection_closed',
          handler: 'hold',
          statusCode: undefined,
          durationMs: expect.any(Number),
        }),
      ]);
      expect(log.mock.calls.map((call: unknown[]) => call[0])).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ event: 'request.succeeded' }),
        ]),
      );
    } finally {
      notifyConnectionClosed = undefined;
      client.destroy();
    }
  });
  it('기존 AppController에도 자동 적용한다', async () => {
    await request(app.getHttpServer())
      .get('/')
      .set('Connection', 'keep-alive')
      .expect(200)
      .expect('Hello World!');
    expect(log.mock.calls.map((c: unknown[]) => c[0])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'request.started',
          controller: 'AppController',
        }),
        expect.objectContaining({
          event: 'request.succeeded',
          statusCode: 200,
        }),
      ]),
    );
  });
});
