import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AccessTokenGuard,
  type AuthenticatedRequest,
} from './access-token.guard.js';
import {
  SocialLoginRequestPipe,
  type SocialLoginRequest,
} from './social-login-request.pipe.js';
import { LinkSocialAccountUseCase } from '@auth/application/link-social-account.use-case.js';
import { StartAppleLoginUseCase } from '@auth/application/start-apple-login.use-case.js';
import { NaverLoginFlow } from '@auth/application/naver-login-flow.js';
import { SocialAccountConflictError } from '@users/domain/errors/social-account-conflict.error.js';
import { UserNotFoundError } from '@users/domain/errors/user-not-found.error.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';
import { LinkedSocialAccountDto } from '@users/presentation/http/user-account.controller.js';
import {
  ApiAuthErrors,
  AppleLoginStartResponseDto,
  socialLoginRequestSchemas,
} from './auth-openapi.js';
import { NaverLoginStartResponseDto } from './naver-login.controller.js';
import { ApiErrorResponseDto } from '../../../common/openapi/api-error.dto.js';

const emptyBodySchema = {
  type: 'object' as const,
  additionalProperties: false,
  maxProperties: 0,
};
@Controller('users/me/social-accounts')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
@ApiTags('회원 계정')
export class SocialAccountLinkController {
  constructor(
    @Inject(LinkSocialAccountUseCase)
    private readonly link: LinkSocialAccountUseCase,
    @Inject(StartAppleLoginUseCase)
    private readonly apple: StartAppleLoginUseCase,
    @Inject(NaverLoginFlow) private readonly naver: NaverLoginFlow,
  ) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: '본인에게 소셜 계정 연동',
    description:
      '제공자 검증 후 현재 회원에게 연결한다. 같은 연결은200, 타 회원의 계정 또는 이미 사용 중인 제공자는409. 새로운 세션 발급이나 계정 병합 없음. Apple/Naver는 본인 연동 시작에서 발급한 시도만 허용한다.',
  })
  @ApiBody({ required: true, schema: { oneOf: socialLoginRequestSchemas } })
  @ApiOkResponse({ type: LinkedSocialAccountDto })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'SOCIAL_ACCOUNT_CONFLICT: 계정 또는 제공자 연결 충돌',
  })
  @ApiAuthErrors(
    'AUTHENTICATION_REQUIRED / INVALID_ACCESS_TOKEN / SOCIAL_AUTHENTICATION_FAILED',
    true,
  )
  async add(
    @Req() request: AuthenticatedRequest,
    @Body(SocialLoginRequestPipe) body: SocialLoginRequest,
  ): Promise<LinkedSocialAccountDto> {
    return this.handle(() => this.link.execute(request.user!.userId, body));
  }
  @Post('apple/start')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: '본인 Apple 연동 시도 시작',
    description:
      '회원에 묶인5분 일회용 nonce 시도. 일반 로그인에 사용할 수 없다.',
  })
  @ApiBody({ required: false, schema: emptyBodySchema })
  @ApiCreatedResponse({ type: AppleLoginStartResponseDto })
  @ApiAuthErrors('AUTHENTICATION_REQUIRED / INVALID_ACCESS_TOKEN')
  async startApple(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    this.requireEmpty(body);
    return this.handle(() => this.apple.execute(request.user!.userId));
  }
  @Post('naver/start')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: '본인 Naver 연동 시도 시작',
    description:
      '회원에 묶인5분 일회용 시도. 공통 Naver callback을 사용하고 완료는 본인 계정 연동 API로 제출한다.',
  })
  @ApiBody({ required: false, schema: emptyBodySchema })
  @ApiCreatedResponse({ type: NaverLoginStartResponseDto })
  @ApiAuthErrors('AUTHENTICATION_REQUIRED / INVALID_ACCESS_TOKEN', true)
  async startNaver(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    this.requireEmpty(body);
    return this.handle(() => this.naver.start(request.user!.userId));
  }
  private requireEmpty(body: unknown): void {
    if (
      body !== undefined &&
      (typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length > 0)
    )
      throw new BadRequestException(['시작 요청에는 입력 필드가 없습니다.']);
  }
  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof SocialAccountConflictError)
        throw new ConflictException({
          code: 'SOCIAL_ACCOUNT_CONFLICT',
          message: '이미 연결된 계정 또는 제공자입니다.',
        });
      if (error instanceof UserNotFoundError)
        throw new UnauthorizedException({
          code: 'INVALID_ACCESS_TOKEN',
          message: '유효하지 않은 Access Token입니다.',
        });
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
