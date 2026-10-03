import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AccessTokenGuard,
  type AuthenticatedRequest,
} from '@auth/presentation/http/access-token.guard.js';
import { WithdrawUserUseCase } from '@users/application/withdraw-user.use-case.js';
import { ListSocialAccountsUseCase } from '@users/application/list-social-accounts.use-case.js';
import { ApiErrorResponseDto } from '../../../common/openapi/api-error.dto.js';
export class LinkedSocialAccountDto {
  @ApiProperty({ type: String, format: 'uuid' }) declare id: string;
  @ApiProperty({ enum: ['google', 'kakao', 'naver', 'apple'] })
  declare provider: string;
  @ApiProperty({ type: String, format: 'date-time' }) declare linkedAt: Date;
}
export class SocialAccountListDto {
  @ApiProperty({ type: () => [LinkedSocialAccountDto] })
  declare socialAccounts: LinkedSocialAccountDto[];
}
@Controller('users/me')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
@ApiTags('회원 계정')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
export class UserAccountController {
  constructor(
    @Inject(WithdrawUserUseCase) private readonly withdraw: WithdrawUserUseCase,
    @Inject(ListSocialAccountsUseCase)
    private readonly list: ListSocialAccountsUseCase,
  ) {}
  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: '본인 회원 즉시 탈퇴',
    description:
      '회원과 모든 소셜 연결·세션·Refresh Token을 원자 삭제한다. 기존 JWT도 이후 인증 시 거부한다. 복구/유예/외부 제공자 연결 해제는 수행하지 않는다.',
  })
  @ApiNoContentResponse({ description: '탈퇴 완료, 응답 본문 없음' })
  async remove(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.withdraw.execute(request.user!.userId);
  }
  @Get('social-accounts')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: '본인의 연결된 소셜 계정 목록 조회' })
  @ApiOkResponse({ type: SocialAccountListDto })
  async accounts(
    @Req() request: AuthenticatedRequest,
  ): Promise<SocialAccountListDto> {
    return { socialAccounts: await this.list.execute(request.user!.userId) };
  }
}
