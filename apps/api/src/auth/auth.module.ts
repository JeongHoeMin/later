import { Module } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { UsersModule } from '@users/users.module.js';
import { FindOrCreateSocialUserUseCase } from '@users/application/find-or-create-social-user.use-case.js';
import { SocialLoginUseCase } from '@auth/application/social-login.use-case.js';
import { GoogleAuthProvider } from '@auth/infrastructure/google/google-auth-provider.js';
import { SocialLoginController } from '@auth/presentation/http/social-login.controller.js';

const GOOGLE_CLIENT_ID = Symbol('GoogleClientId');

@Module({
  imports: [UsersModule],
  controllers: [SocialLoginController],
  providers: [
    {
      provide: GOOGLE_CLIENT_ID,
      useFactory: () => {
        const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
        if (!clientId) throw new Error('GOOGLE_CLIENT_ID가 필요합니다.');
        return clientId;
      },
    },
    { provide: OAuth2Client, useFactory: () => new OAuth2Client() },
    {
      provide: GoogleAuthProvider,
      inject: [GOOGLE_CLIENT_ID, OAuth2Client],
      useFactory: (clientId: string, client: OAuth2Client) =>
        new GoogleAuthProvider(clientId, client),
    },
    {
      provide: SocialLoginUseCase,
      inject: [GoogleAuthProvider, FindOrCreateSocialUserUseCase],
      useFactory: (
        google: GoogleAuthProvider,
        users: FindOrCreateSocialUserUseCase,
      ) => new SocialLoginUseCase([google], users),
    },
  ],
  exports: [SocialLoginUseCase],
})
export class AuthModule {}
