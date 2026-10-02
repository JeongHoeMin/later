import { Module } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { UsersModule } from '@users/users.module.js';
import { FindOrCreateSocialUserUseCase } from '@users/application/find-or-create-social-user.use-case.js';
import { SocialLoginUseCase } from '@auth/application/social-login.use-case.js';
import { GoogleAuthProvider } from '@auth/infrastructure/google/google-auth-provider.js';
import { KakaoAuthProvider } from '@auth/infrastructure/kakao/kakao-auth-provider.js';
import { NaverAuthProvider } from '@auth/infrastructure/naver/naver-auth-provider.js';
import { SocialLoginController } from '@auth/presentation/http/social-login.controller.js';
import { AccessTokenModule } from './access-token.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { PrismaClient } from '@db/client.js';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from './application/ports/access-token.js';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from './application/ports/auth-session.repository.js';
import {
  REFRESH_TOKEN_GENERATOR,
  type RefreshTokenGenerator,
} from './application/ports/refresh-token-generator.js';
import { SecureRefreshTokenGenerator } from './infrastructure/tokens/secure-refresh-token-generator.js';
import { PrismaAuthSessionRepository } from './infrastructure/persistence/prisma-auth-session.repository.js';
import { IssueSessionUseCase } from './application/issue-session.use-case.js';
import { SocialSignInUseCase } from './application/social-sign-in.use-case.js';
import {
  REFRESH_SESSION_REPOSITORY,
  type RefreshSessionRepository,
} from './application/ports/refresh-session.repository.js';
import { RefreshSessionUseCase } from './application/refresh-session.use-case.js';
import { LogoutSessionUseCase } from './application/logout-session.use-case.js';
import { SessionController } from './presentation/http/session.controller.js';

const GOOGLE_CLIENT_ID = Symbol('GoogleClientId');

@Module({
  imports: [UsersModule, PrismaModule, AccessTokenModule],
  controllers: [SocialLoginController, SessionController],
  providers: [
    {
      provide: REFRESH_SESSION_REPOSITORY,
      useExisting: AUTH_SESSION_REPOSITORY,
    },
    {
      provide: RefreshSessionUseCase,
      inject: [
        ACCESS_TOKEN_ISSUER,
        REFRESH_TOKEN_GENERATOR,
        REFRESH_SESSION_REPOSITORY,
      ],
      useFactory: (
        access: AccessTokenIssuer,
        tokens: RefreshTokenGenerator,
        sessions: RefreshSessionRepository,
      ) => new RefreshSessionUseCase(access, tokens, sessions),
    },
    {
      provide: LogoutSessionUseCase,
      inject: [REFRESH_TOKEN_GENERATOR, REFRESH_SESSION_REPOSITORY],
      useFactory: (
        tokens: RefreshTokenGenerator,
        sessions: RefreshSessionRepository,
      ) => new LogoutSessionUseCase(tokens, sessions),
    },
    {
      provide: REFRESH_TOKEN_GENERATOR,
      useFactory: () => new SecureRefreshTokenGenerator(),
    },
    {
      provide: AUTH_SESSION_REPOSITORY,
      inject: [PrismaClient],
      useFactory: (client: PrismaClient) =>
        new PrismaAuthSessionRepository(client),
    },
    {
      provide: IssueSessionUseCase,
      inject: [
        ACCESS_TOKEN_ISSUER,
        REFRESH_TOKEN_GENERATOR,
        AUTH_SESSION_REPOSITORY,
      ],
      useFactory: (
        access: AccessTokenIssuer,
        refresh: RefreshTokenGenerator,
        sessions: AuthSessionRepository,
      ) => new IssueSessionUseCase(access, refresh, sessions),
    },
    {
      provide: SocialSignInUseCase,
      inject: [SocialLoginUseCase, IssueSessionUseCase],
      useFactory: (social: SocialLoginUseCase, sessions: IssueSessionUseCase) =>
        new SocialSignInUseCase(social, sessions),
    },
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
      provide: KakaoAuthProvider,
      useFactory: () => new KakaoAuthProvider(process.env.KAKAO_APP_ID ?? ''),
    },
    {
      provide: SocialLoginUseCase,
      inject: [
        GoogleAuthProvider,
        KakaoAuthProvider,
        NaverAuthProvider,
        FindOrCreateSocialUserUseCase,
      ],
      useFactory: (
        google: GoogleAuthProvider,
        kakao: KakaoAuthProvider,
        naver: NaverAuthProvider,
        users: FindOrCreateSocialUserUseCase,
      ) => new SocialLoginUseCase([google, kakao, naver], users),
    },
    {
      provide: NaverAuthProvider,
      useFactory: () =>
        new NaverAuthProvider(
          process.env.NAVER_CLIENT_ID ?? '',
          process.env.NAVER_CLIENT_SECRET ?? '',
        ),
    },
  ],
  exports: [SocialLoginUseCase],
})
export class AuthModule {}
