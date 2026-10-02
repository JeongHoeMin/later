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
import {
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiAuthErrors,
  SessionTokensDto,
  refreshTokenRequestSchema,
} from './auth-openapi.js';

@Controller('auth')
@ApiTags('세션')
export class SessionController {
  constructor(
    @Inject(RefreshSessionUseCase)
    private readonly refreshSession: RefreshSessionUseCase,
    @Inject(LogoutSessionUseCase)
    private readonly logoutSession: LogoutSessionUseCase,
  ) {}

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '서비스 토큰 갱신',
    description:
      'Refresh Token을 회전한다. 동시 갱신을 피하고 성공한 새 토큰으로 교체한다. 기존 토큰 재사용은 해당 세션을 폐기한다.',
    security: [],
  })
  @ApiBody({ required: true, schema: refreshTokenRequestSchema })
  @ApiOkResponse({ type: SessionTokensDto })
  @ApiAuthErrors('INVALID_REFRESH_TOKEN: 만료·폐기·재사용·알 수 없는 토큰')
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
  @ApiOperation({
    summary: '서비스 세션 로그아웃',
    description:
      '해당 Refresh Token의 세션을 폐기한다. 이미 폐기·알 수 없는 토큰도 204이며 다른 기기 세션은 유지한다. 기존 Access Token은 만료까지 유효하다.',
    security: [],
  })
  @ApiBody({ required: true, schema: refreshTokenRequestSchema })
  @ApiNoContentResponse({ description: '응답 본문 없음' })
  @ApiAuthErrors()
  async logout(
    @Body(RefreshTokenRequestPipe) request: RefreshTokenRequest,
  ): Promise<void> {
    await this.logoutSession.execute(request.refreshToken);
  }
}
