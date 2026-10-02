import {
  Body,
  Controller,
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

export type SocialLoginResponse = SocialSignInResult;

@Controller('auth/social')
export class SocialLoginController {
  constructor(
    @Inject(SocialSignInUseCase)
    private readonly loginUseCase: SocialSignInUseCase,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(SocialLoginRequestPipe) request: SocialLoginRequest,
  ): Promise<SocialLoginResponse> {
    try {
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
