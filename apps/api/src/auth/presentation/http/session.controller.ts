import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { RefreshSessionUseCase } from '@auth/application/refresh-session.use-case.js';
import { LogoutSessionUseCase } from '@auth/application/logout-session.use-case.js';
import { InvalidRefreshTokenError } from '@auth/domain/errors/invalid-refresh-token.error.js';
import type { SessionTokens } from '@auth/application/issue-session.use-case.js';
import {
  RefreshTokenRequestPipe,
  type RefreshTokenRequest,
} from './refresh-token-request.pipe.js';

@Controller('auth')
export class SessionController {
  constructor(
    @Inject(RefreshSessionUseCase)
    private readonly refreshSession: RefreshSessionUseCase,
    @Inject(LogoutSessionUseCase)
    private readonly logoutSession: LogoutSessionUseCase,
  ) {}

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(RefreshTokenRequestPipe) request: RefreshTokenRequest,
  ): Promise<SessionTokens> {
    try {
      return await this.refreshSession.execute(request.refreshToken);
    } catch (error: unknown) {
      if (error instanceof InvalidRefreshTokenError)
        throw new UnauthorizedException({
          code: 'INVALID_REFRESH_TOKEN',
          message: '유효하지 않은 Refresh Token입니다.',
        });
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(RefreshTokenRequestPipe) request: RefreshTokenRequest,
  ): Promise<void> {
    await this.logoutSession.execute(request.refreshToken);
  }
}
