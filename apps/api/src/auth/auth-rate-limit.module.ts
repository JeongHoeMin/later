import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { PrismaClient } from '@db/client.js';
import { AUTH_RATE_LIMIT_REPOSITORY } from './application/ports/auth-rate-limit.repository.js';
import { PrismaAuthRateLimitRepository } from './infrastructure/rate-limit/prisma-auth-rate-limit.repository.js';
import {
  AuthIpRateLimitGuard,
  AuthMemberRateLimitGuard,
} from './presentation/http/auth-rate-limit.guard.js';
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: AUTH_RATE_LIMIT_REPOSITORY,
      inject: [PrismaClient],
      useFactory: (client: PrismaClient) =>
        new PrismaAuthRateLimitRepository(client),
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
