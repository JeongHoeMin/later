import { UserAccountModule } from '@users/user-account.module.js';
import { Module } from '@nestjs/common';
import {
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_VERIFIER,
} from '@auth/application/ports/access-token.js';
import { JwtAccessToken } from '@auth/infrastructure/tokens/jwt-access-token.js';
import { AccessTokenGuard } from '@auth/presentation/http/access-token.guard.js';

@Module({
  imports: [UserAccountModule],
  providers: [
    {
      provide: JwtAccessToken,
      useFactory: () =>
        new JwtAccessToken(process.env.ACCESS_TOKEN_SECRET ?? ''),
    },
    { provide: ACCESS_TOKEN_ISSUER, useExisting: JwtAccessToken },
    { provide: ACCESS_TOKEN_VERIFIER, useExisting: JwtAccessToken },
    AccessTokenGuard,
  ],
  exports: [
    ACCESS_TOKEN_ISSUER,
    ACCESS_TOKEN_VERIFIER,
    AccessTokenGuard,
    UserAccountModule,
  ],
})
export class AccessTokenModule {}
