import { AUTH_RATE_LIMIT_REPOSITORY } from '@auth/application/ports/auth-rate-limit.repository.js';
import { TestAuthRateLimitRepository } from './helpers/test-auth-rate-limit.repository.js';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '@db/client.js';
import { setupOpenApi } from '../src/common/openapi/setup-openapi.js';
import { SocialLoginRequestPipe } from '@auth/presentation/http/social-login-request.pipe.js';
import { BadRequestException } from '@nestjs/common';

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
      .overrideProvider(AUTH_RATE_LIMIT_REPOSITORY)
      .useValue(new TestAuthRateLimitRepository())
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
      '/auth/social/naver/start',
      '/auth/social/naver/callback',
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
  it('네이버 전용 API의 입력·리다이렉트·응답 계약을 제공한다', async () => {
    const { body: document } = await request(app.getHttpServer())
      .get('/docs-json')
      .set('Connection', 'keep-alive')
      .expect(200);
    const start = document.paths['/auth/social/naver/start'].post;
    expect(start.requestBody.required).toBe(false);
    expect(start.responses['201']).toBeDefined();
    expect(
      document.components.schemas.NaverLoginStartResponseDto.required,
    ).toEqual([
      'loginAttemptId',
      'attemptSecret',
      'authorizationUrl',
      'expiresIn',
    ]);
    const callback = document.paths['/auth/social/naver/callback'].get;
    expect(
      callback.parameters.find(
        (value: { name: string }) => value.name === 'state',
      ).required,
    ).toBe(true);
    expect(callback.responses['303'].headers.Location.schema.type).toBe(
      'string',
    );
    expect(document.paths['/auth/social/naver/complete']).toBeUndefined();
    const complete = document.paths['/auth/social/login'].post;
    const schema = complete.requestBody.content[
      'application/json'
    ].schema.oneOf.find(
      (value: { properties: { provider: { enum: string[] } } }) =>
        value.properties.provider.enum[0] === 'naver',
    );
    expect(schema.required).toEqual([
      'provider',
      'loginAttemptId',
      'attemptSecret',
    ]);
    expect(schema.additionalProperties).toBe(false);
    expect(
      complete.responses['200'].content['application/json'].schema.$ref,
    ).toContain('SocialLoginResponseDto');
    for (const operation of [start, callback, complete]) {
      expect(operation.responses['400']).toBeDefined();
      expect(operation.responses['503']).toBeDefined();
      expect(operation.responses['500']).toBeDefined();
      expect(operation.security ?? []).toEqual([]);
    }
    for (const operation of [callback, complete])
      expect(operation.responses['401']).toBeDefined();
  });
  it('제공자별 로그인 필수 필드와 추가 필드 금지 계약을 제공한다', async () => {
    const { body: document } = await request(app.getHttpServer())
      .get('/docs-json')
      .set('Connection', 'keep-alive')
      .expect(200);
    const operation = document.paths['/auth/social/login'].post;
    expect(operation.requestBody).toBeDefined();
    const schema = operation.requestBody.content['application/json'].schema;
    expect(schema.oneOf).toHaveLength(4);
    const models = schema.oneOf;
    for (const [provider, extra] of [
      ['google', undefined],
      ['kakao', undefined],
      ['naver', 'loginAttemptId'],
      ['apple', 'loginAttemptId'],
    ]) {
      const model = models.find(
        (value: { properties: { provider: { enum: string[] } } }) =>
          value.properties.provider.enum[0] === provider,
      );
      expect(model.required).toEqual(
        provider === 'naver'
          ? ['provider', 'loginAttemptId', 'attemptSecret']
          : extra
            ? ['provider', 'credential', extra]
            : ['provider', 'credential'],
      );
      expect(model.additionalProperties).toBe(false);
      expect(Object.keys(model.properties)).toEqual(model.required);
    }
    expect(document.paths['/auth/social/login'].post.requestBody.required).toBe(
      true,
    );
  });
  it('로그인과 세션 성공·오류 응답 및 인증 요구사항을 실제 계약대로 제공한다', async () => {
    const { body: document } = await request(app.getHttpServer())
      .get('/docs-json')
      .set('Connection', 'keep-alive')
      .expect(200);
    const schemas = document.components.schemas;
    expect(schemas).toHaveProperty('SocialLoginResponseDto');
    expect(schemas.SocialLoginResponseDto.required).toEqual(
      expect.arrayContaining([
        'user',
        'accessToken',
        'refreshToken',
        'tokenType',
        'expiresIn',
      ]),
    );
    expect(schemas.AppleLoginStartResponseDto.required).toEqual([
      'loginAttemptId',
      'nonce',
      'expiresIn',
    ]);
    expect(
      document.paths['/auth/token/refresh'].post.requestBody.content[
        'application/json'
      ].schema.required,
    ).toEqual(['refreshToken']);
    for (const [path, status] of [
      ['/auth/social/login', '200'],
      ['/auth/social/apple/start', '201'],
      ['/auth/token/refresh', '200'],
      ['/auth/logout', '204'],
    ]) {
      const operation = document.paths[path].post;
      expect(operation.responses[status]).toBeDefined();
      expect(operation.responses['400']).toBeDefined();
      expect(operation.responses['500']).toBeDefined();
      expect(operation.security ?? []).toEqual([]);
    }
    expect(
      document.paths['/auth/social/login'].post.responses['401'],
    ).toBeDefined();
    expect(
      document.paths['/auth/social/login'].post.responses['503'],
    ).toBeDefined();
    expect(
      document.paths['/auth/token/refresh'].post.responses['401'],
    ).toBeDefined();
    expect(
      document.paths['/auth/logout'].post.responses['204'].content,
    ).toBeUndefined();
    expect(
      document.paths['/auth/social/apple/start'].post.requestBody.required,
    ).toBe(false);
    expect(schemas.ApiErrorResponseDto.required).toEqual(['error']);
    expect(schemas.ApiErrorDto.properties.details.items.type).toBe('string');
    const baseResponse = await request(app.getHttpServer())
      .get('/')
      .set('Connection', 'keep-alive')
      .expect(200);
    const mediaType = baseResponse.headers['content-type'].split(';')[0];
    expect(
      document.paths['/'].get.responses['200'].content[mediaType].schema.type,
    ).toBe('string');
  });
  it('문서 예시·필수 필드·추가 필드가 실제 로그인 Pipe와 일치한다', async () => {
    const { body: document } = await request(app.getHttpServer())
      .get('/docs-json')
      .set('Connection', 'keep-alive')
      .expect(200);
    const requestBody = document.paths['/auth/social/login'].post.requestBody;
    const schema = requestBody.content['application/json'].schema;
    const examples = requestBody.content['application/json'].examples;
    const pipe = new SocialLoginRequestPipe();
    for (const [provider, example] of Object.entries(examples) as [
      string,
      { value: Record<string, string> },
    ][]) {
      expect(pipe.transform(example.value)).toEqual(example.value);
      const model = schema.oneOf.find(
        (value: { properties: { provider: { enum: string[] } } }) =>
          value.properties.provider.enum[0] === provider,
      );
      for (const [field, property] of Object.entries(model.properties) as [
        string,
        { pattern?: string },
      ][]) {
        if (property.pattern)
          expect(new RegExp(property.pattern).test(example.value[field])).toBe(
            true,
          );
      }
      if (model.properties.credential)
        expect(
          new RegExp(model.properties.credential.pattern).test('   '),
        ).toBe(false);
      for (const required of model.required) {
        const invalid = { ...example.value };
        delete invalid[required];
        expect(() => pipe.transform(invalid)).toThrow(BadRequestException);
      }
      expect(() =>
        pipe.transform({ ...example.value, unexpected: 'field' }),
      ).toThrow(BadRequestException);
    }
  });
});
