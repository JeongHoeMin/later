import { AuthRateLimit } from './auth-rate-limit.js';
import { AuthIpRateLimitGuard } from './auth-rate-limit.guard.js';
import {
  BadRequestException,
  Body,
  UseGuards,
  Controller,
  Inject,
  Post,
} from '@nestjs/common';
import { StartAppleLoginUseCase } from '@auth/application/start-apple-login.use-case.js';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuthErrors, AppleLoginStartResponseDto } from './auth-openapi.js';

@Controller('auth/social/apple')
@UseGuards(AuthIpRateLimitGuard)
@AuthRateLimit('login')
@ApiTags('인증')
export class AppleLoginController {
  constructor(
    @Inject(StartAppleLoginUseCase)
    private readonly startUseCase: StartAppleLoginUseCase,
  ) {}

  @Post('start')
  @ApiOperation({
    summary: 'Apple 로그인 시도와 nonce 생성',
    description:
      '5분간 유효한 일회용 시도. nonce를 Apple 인증 요청에 그대로 전달한다.',
    security: [],
  })
  @ApiBody({
    required: false,
    schema: { type: 'object', additionalProperties: false, maxProperties: 0 },
  })
  @ApiCreatedResponse({ type: AppleLoginStartResponseDto })
  @ApiAuthErrors()
  start(@Body() body: unknown) {
    if (
      body !== undefined &&
      (typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length > 0)
    )
      throw new BadRequestException([
        'Apple 로그인 시작 요청에는 입력 필드가 없습니다.',
      ]);
    return this.startUseCase.execute();
  }
}
