import { NaverLoginFlow } from '@auth/application/naver-login-flow.js';
import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SocialSignInUseCase,
  type SocialSignInResult,
} from '@auth/application/social-sign-in.use-case.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';
import {
  SocialLoginRequestPipe,
  type SocialLoginRequest,
} from './social-login-request.pipe.js';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiAuthErrors,
  SocialLoginResponseDto,
  socialLoginRequestSchemas,
} from './auth-openapi.js';

export type SocialLoginResponse = SocialSignInResult;

@Controller('auth/social')
@ApiTags('인증')
export class SocialLoginController {
  constructor(
    @Inject(SocialSignInUseCase)
    private readonly loginUseCase: SocialSignInUseCase,
    @Inject(NaverLoginFlow) private readonly naverFlow: NaverLoginFlow,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: '소셜 인증 후 회원 연결과 서비스 로그인',
    description:
      'Google ID token, Kakao access token 또는 Apple ID token/loginAttemptId를 검증한다. 네이버는 start/callback 이후 시도 ID와 비밀값으로 이 경로에서 완료한다. 네이버·Apple 시도는 회원·세션 저장 전에 소비되므로 이후 오류·응답 유실 시 새 시도로 시작한다.',
    security: [],
  })
  @ApiBody({
    required: true,
    schema: { oneOf: socialLoginRequestSchemas },
    examples: {
      google: { value: { provider: 'google', credential: 'GOOGLE_ID_TOKEN' } },
      kakao: { value: { provider: 'kakao', credential: 'KAKAO_ACCESS_TOKEN' } },
      naver: {
        value: {
          provider: 'naver',
          loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
          attemptSecret: 'x'.repeat(43),
        },
      },
      apple: {
        value: {
          provider: 'apple',
          credential: 'APPLE_ID_TOKEN',
          loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
        },
      },
    },
  })
  @ApiOkResponse({
    type: SocialLoginResponseDto,
    description: '신규·기존 회원 모두 동일한 서비스 로그인 응답',
  })
  @ApiAuthErrors(
    'SOCIAL_AUTHENTICATION_FAILED: 잘못된·만료된 인증 정보 또는 네이버·Apple 시도 불일치·재사용',
    true,
  )
  async login(
    @Body(SocialLoginRequestPipe) request: SocialLoginRequest,
  ): Promise<SocialLoginResponse> {
    try {
      if (request.provider === 'naver')
        return await this.naverFlow.complete(
          request.loginAttemptId,
          request.attemptSecret,
        );
      return await this.loginUseCase.execute(request);
    } catch (error: unknown) {
      if (error instanceof SocialAuthenticationUnavailableError) {
        throw new ServiceUnavailableException(
          '소셜 인증을 일시적으로 사용할 수 없습니다.',
        );
      }
      if (error instanceof SocialAuthenticationFailedError) {
        throw new UnauthorizedException({
          code: 'SOCIAL_AUTHENTICATION_FAILED',
          message: '소셜 인증에 실패했습니다.',
        });
      }
      throw error;
    }
  }
}
