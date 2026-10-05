import { Module } from '@nestjs/common';
import { AUTH_RATE_LIMIT_REPOSITORY } from './application/ports/auth-rate-limit.repository.js';
import {
  RedisAuthRateLimitRepository,
  readRedisUrl,
} from './infrastructure/rate-limit/redis-auth-rate-limit.repository.js';
import {
  AuthIpRateLimitGuard,
  AuthMemberRateLimitGuard,
} from './presentation/http/auth-rate-limit.guard.js';
@Module({
  providers: [
    {
      provide: AUTH_RATE_LIMIT_REPOSITORY,
      useFactory: () =>
        new RedisAuthRateLimitRepository(readRedisUrl(process.env.REDIS_URL)),
    },
    AuthIpRateLimitGuard,
    AuthMemberRateLimitGuard,
  ],
  exports: [
    AUTH_RATE_LIMIT_REPOSITORY,
    AuthIpRateLimitGuard,
    AuthMemberRateLimitGuard,
  ],
})
export class AuthRateLimitModule {}
