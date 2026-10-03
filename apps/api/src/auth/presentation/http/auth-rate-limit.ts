import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../../common/openapi/api-error.dto.js';
export type AuthRateLimitGroup = 'login' | 'refresh' | 'logout' | 'link';
export const AUTH_RATE_LIMIT_GROUP = 'auth.rate-limit.group';
export const authRateLimits: Record<AuthRateLimitGroup, number> = {
  login: 20,
  refresh: 60,
  logout: 60,
  link: 10,
};
export function AuthRateLimit(group: AuthRateLimitGroup) {
  return applyDecorators(
    SetMetadata(AUTH_RATE_LIMIT_GROUP, group),
    ApiResponse({
      status: 429,
      type: ApiErrorResponseDto,
      description:
        'RATE_LIMIT_EXCEEDED: 요청 제한 초과. Retry-After 이후 재시도.',
      headers: {
        'Retry-After': {
          description: '재시도까지 남은 초',
          schema: { type: 'integer', minimum: 1 },
        },
      },
    }),
  );
}
