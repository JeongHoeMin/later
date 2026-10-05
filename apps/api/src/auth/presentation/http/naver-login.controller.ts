import { AuthRateLimit } from './auth-rate-limit.js';
import { AuthIpRateLimitGuard } from './auth-rate-limit.guard.js';
import {
  BadRequestException,
  Body,
  UseGuards,
  Controller,
  Get,
  Header,
  Inject,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { NaverLoginFlow } from '@auth/application/naver-login-flow.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';
import { ApiAuthErrors } from './auth-openapi.js';

export class NaverLoginStartResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) declare loginAttemptId: string;
  @ApiProperty({
    type: String,
    pattern: '^[A-Za-z0-9_-]{43}$',
    description: '앱에만 보관. URL·로그에 포함하지 않는다.',
  })
  declare attemptSecret: string;
  @ApiProperty({
    type: String,
    format: 'uri',
    description: '브라우저로 열 네이버 인가 URL',
  })
  declare authorizationUrl: string;
  @ApiProperty({ type: Number, example: 300 }) declare expiresIn: number;
}

@Controller('auth/social/naver')
@UseGuards(AuthIpRateLimitGuard)
@AuthRateLimit('login')
@ApiTags('인증')
export class NaverLoginController {
  constructor(@Inject(NaverLoginFlow) private readonly flow: NaverLoginFlow) {}

  @Post('start')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: '네이버 로그인 시작',
    description:
      '시도 ID와 비밀값을 앱에 보관한 뒤 authorizationUrl을 브라우저로 연다. 시도 유효기간은 5분.',
    security: [],
  })
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false, maxProperties: 0 },
  })
  @ApiCreatedResponse({ type: NaverLoginStartResponseDto })
  @ApiAuthErrors(undefined, true)
  async start(@Body() body: unknown) {
    if (
      body !== undefined &&
      (typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length)
    )
      throw new BadRequestException(['시작 요청에는 입력 필드가 없습니다.']);
    return this.handle(() => this.flow.start());
  }

  @Get('callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiOperation({
    summary: '네이버 브라우저 로그인 Callback',
    description:
      '네이버가 code/state 또는 error/state를 보내는 주소. 서버 검증 후 고정 앱 URL에 loginAttemptId만 포함해 303. 앱이 직접 호출하는 API가 아니다.',
    security: [],
  })
  @ApiQuery({ name: 'state', required: true, type: String })
  @ApiQuery({
    name: 'code',
    required: false,
    type: String,
    description: '성공 시 필수, error와 동시 제출 금지',
  })
  @ApiQuery({
    name: 'error',
    required: false,
    type: String,
    description: '실패 시 필수, code와 동시 제출 금지',
  })
  @ApiQuery({ name: 'error_description', required: false, type: String })
  @ApiResponse({
    status: 303,
    description: '고정 앱 반환 주소로 이동. Location에는 시도 ID만 포함.',
    headers: { Location: { schema: { type: 'string' } } },
  })
  @ApiAuthErrors('SOCIAL_AUTHENTICATION_FAILED: state 불일치·만료·재사용', true)
  async callback(
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const nonblank = (value: unknown): value is string =>
      typeof value === 'string' && value.length > 0 && !/\s/.test(value);
    const success = nonblank(query.code) && query.error === undefined;
    const failure = nonblank(query.error) && query.code === undefined;
    if (
      !nonblank(query.state) ||
      (!success && !failure) ||
      (query.error_description !== undefined &&
        typeof query.error_description !== 'string') ||
      Object.keys(query).some(
        (key) => !['state', 'code', 'error', 'error_description'].includes(key),
      )
    )
      throw new BadRequestException([
        '콜백에는 state와 code 또는 error가 필요합니다.',
      ]);
    const location = await this.handle(() =>
      this.flow.callback(
        query.state as string,
        success ? (query.code as string) : null,
      ),
    );
    response.status(303).setHeader('Location', location);
  }

  private async handle<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error: unknown) {
      if (error instanceof SocialAuthenticationFailedError)
        throw new UnauthorizedException({
          code: 'SOCIAL_AUTHENTICATION_FAILED',
          message: '소셜 인증에 실패했습니다.',
        });
      if (error instanceof SocialAuthenticationUnavailableError)
        throw new ServiceUnavailableException(
          '소셜 인증을 일시적으로 사용할 수 없습니다.',
        );
      throw error;
    }
  }
}
