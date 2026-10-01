import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SocialLoginUseCase } from '@auth/application/social-login.use-case.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import {
  SocialLoginRequestPipe,
  type SocialLoginRequest,
} from './social-login-request.pipe.js';

export type SocialLoginResponse = { user: { id: string } };

@Controller('auth/social')
export class SocialLoginController {
  constructor(
    @Inject(SocialLoginUseCase)
    private readonly loginUseCase: SocialLoginUseCase,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(SocialLoginRequestPipe) request: SocialLoginRequest,
  ): Promise<SocialLoginResponse> {
    try {
      const user = await this.loginUseCase.execute(request);
      return { user: { id: user.id } };
    } catch (error: unknown) {
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
