import {
  Controller,
  Get,
  Header,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AccessTokenGuard,
  type AuthenticatedRequest,
} from './access-token.guard.js';
import { SocialUserResponseDto } from './auth-openapi.js';
import { ApiErrorResponseDto } from '../../../common/openapi/api-error.dto.js';

export class AuthenticatedUserResponseDto {
  @ApiProperty({ type: () => SocialUserResponseDto })
  declare user: SocialUserResponseDto;
}

@Controller('auth')
@ApiTags('인증 회원')
export class AuthenticatedUserController {
  @Get('me')
  @UseGuards(AccessTokenGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '인증된 회원 ID 확인',
    description:
      '서비스 Access Token의 검증된 회원 ID를 반환한다. DB 회원 존재를 확인하며 탈퇴한 회원의 JWT는 거부한다. 권한·로그아웃된 세션 여부는 조회하지 않으며 일반 로그아웃의 Access Token은 만료까지 유효하다.',
  })
  @ApiOkResponse({
    type: AuthenticatedUserResponseDto,
    headers: {
      'Cache-Control': { schema: { type: 'string', enum: ['no-store'] } },
    },
  })
  @ApiUnauthorizedResponse({
    type: ApiErrorResponseDto,
    description:
      'AUTHENTICATION_REQUIRED: Bearer 누락·형식 오류 / INVALID_ACCESS_TOKEN: 잘못된·만료된 서비스 JWT',
    headers: {
      'WWW-Authenticate': { schema: { type: 'string', enum: ['Bearer'] } },
    },
  })
  @ApiInternalServerErrorResponse({
    type: ApiErrorResponseDto,
    description: 'INTERNAL_SERVER_ERROR: 검증 시스템 오류, 원문 비노출',
  })
  read(@Req() request: AuthenticatedRequest): AuthenticatedUserResponseDto {
    if (!request.user)
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: '인증이 필요합니다.',
      });
    return { user: { id: request.user.userId } };
  }
}
