import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiUnauthorizedResponse,
  type SchemaObject,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../../common/openapi/api-error.dto.js';
import type { SessionTokens } from '@auth/application/issue-session.use-case.js';
import type { SocialSignInResult } from '@auth/application/social-sign-in.use-case.js';
import { APPLE_LOGIN_ATTEMPT_ID_PATTERN } from '@auth/domain/apple-login-attempt.js';

const credentialSchema: SchemaObject = {
  type: 'string',
  minLength: 1,
  pattern: '\\S',
  description: '제공자 인증 정보. 토큰·코드를 로그에 기록하지 않는다.',
};

export const socialLoginRequestSchemas: SchemaObject[] = [
  'google',
  'kakao',
  'apple',
].map((provider) => {
  const properties: Record<string, SchemaObject> = {
    provider: { type: 'string', enum: [provider] },
    credential: credentialSchema,
  };
  const required = ['provider', 'credential'];
  if (provider === 'apple') {
    properties.loginAttemptId = {
      type: 'string',
      format: 'uuid',
      pattern: APPLE_LOGIN_ATTEMPT_ID_PATTERN,
      description: 'Apple start API에서 발급한 UUID v4',
    };
    required.push('loginAttemptId');
  }
  return { type: 'object', properties, required, additionalProperties: false };
});

export const refreshTokenRequestSchema: SchemaObject = {
  type: 'object',
  properties: {
    refreshToken: {
      type: 'string',
      minLength: 1,
      pattern: '\\S',
      description: 'Later 서비스 Refresh Token',
    },
  },
  required: ['refreshToken'],
  additionalProperties: false,
};

export class SessionTokensDto implements SessionTokens {
  @ApiProperty({ type: String, description: 'Later 서비스 Access Token (JWT)' })
  declare accessToken: string;
  @ApiProperty({
    type: String,
    description: 'Later 서비스 Refresh Token. 플랫폼 보안 저장소에 보관',
  })
  declare refreshToken: string;
  @ApiProperty({ type: String, enum: ['Bearer'] })
  declare tokenType: 'Bearer';
  @ApiProperty({
    type: Number,
    example: 900,
    description: 'Access Token 유효기간(초)',
  })
  declare expiresIn: number;
}

export class SocialUserResponseDto {
  @ApiProperty({ type: String, format: 'uuid', description: 'Later 회원 ID' })
  declare id: string;
}

export class SocialLoginResponseDto
  extends SessionTokensDto
  implements SocialSignInResult
{
  @ApiProperty({ type: () => SocialUserResponseDto })
  declare user: SocialUserResponseDto;
}

export class AppleLoginStartResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  declare loginAttemptId: string;
  @ApiProperty({
    type: String,
    description: 'Apple 인증 요청에 그대로 전달할 서버 생성 nonce',
  })
  declare nonce: string;
  @ApiProperty({ type: Number, example: 300, description: '시도 유효기간(초)' })
  declare expiresIn: number;
}

export function ApiAuthErrors(authentication?: string, unavailable = false) {
  return applyDecorators(
    ApiBadRequestResponse({
      type: ApiErrorResponseDto,
      description: 'BAD_REQUEST: 본문·필수 필드·추가 필드 오류',
    }),
    ApiInternalServerErrorResponse({
      type: ApiErrorResponseDto,
      description: 'INTERNAL_SERVER_ERROR: 내부 오류, 원문 비노출',
    }),
    ...(authentication
      ? [
          ApiUnauthorizedResponse({
            type: ApiErrorResponseDto,
            description: authentication,
          }),
        ]
      : []),
    ...(unavailable
      ? [
          ApiServiceUnavailableResponse({
            type: ApiErrorResponseDto,
            description:
              'INTERNAL_SERVER_ERROR: 외부 인증 일시 장애·통신·timeout·비정상 응답',
          }),
        ]
      : []),
  );
}
