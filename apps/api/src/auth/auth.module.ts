import {
  AUTH_CLEANUP_REPOSITORY,
  type AuthCleanupRepository,
} from './application/ports/auth-cleanup.repository.js';
import { CleanupExpiredAuthUseCase } from './application/cleanup-expired-auth.use-case.js';
import { AuthCleanupScheduler } from './infrastructure/cleanup/auth-cleanup.scheduler.js';
import { PrismaAuthCleanupRepository } from './infrastructure/persistence/prisma-auth-cleanup.repository.js';
import { SocialAccountLinkController } from './presentation/http/social-account-link.controller.js';
import { LinkSocialAccountUseCase } from './application/link-social-account.use-case.js';
import {
  USER_ACCOUNT_REPOSITORY,
  type UserAccountRepository,
} from '@users/application/ports/user-account.repository.js';
import { UserAccountModule } from '@users/user-account.module.js';
import { UserAccountController } from '@users/presentation/http/user-account.controller.js';
import { NaverLoginFlow } from './application/naver-login-flow.js';
import {
  NAVER_LOGIN_ATTEMPTS,
  type NaverLoginAttemptRepository,
} from './application/ports/naver-login-attempt.repository.js';
import { PrismaNaverLoginAttemptRepository } from './infrastructure/persistence/prisma-naver-login-attempt.repository.js';
import { SecureNaverLogin } from './infrastructure/naver/naver-login-security.js';
import { readNaverLoginSettings } from './infrastructure/naver/naver-login-settings.js';
import { NaverLoginController } from './presentation/http/naver-login.controller.js';
import { Module } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { UsersModule } from '@users/users.module.js';
import { FindOrCreateSocialUserUseCase } from '@users/application/find-or-create-social-user.use-case.js';
import { SocialLoginUseCase } from '@auth/application/social-login.use-case.js';
import { GoogleAuthProvider } from '@auth/infrastructure/google/google-auth-provider.js';
import { KakaoAuthProvider } from '@auth/infrastructure/kakao/kakao-auth-provider.js';
import { NaverAuthProvider } from '@auth/infrastructure/naver/naver-auth-provider.js';
import { AppleAuthProvider } from '@auth/infrastructure/apple/apple-auth-provider.js';
import { SecureAppleLoginAttemptGenerator } from '@auth/infrastructure/apple/secure-apple-login-attempt-generator.js';
import { PrismaAppleLoginAttemptRepository } from '@auth/infrastructure/persistence/prisma-apple-login-attempt.repository.js';
import {
  APPLE_LOGIN_ATTEMPT_REPOSITORY,
  type AppleLoginAttemptRepository,
} from '@auth/application/ports/apple-login-attempt.repository.js';
import { StartAppleLoginUseCase } from '@auth/application/start-apple-login.use-case.js';
import { AppleLoginController } from '@auth/presentation/http/apple-login.controller.js';
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
import { AuthenticatedUserController } from './presentation/http/authenticated-user.controller.js';

const GOOGLE_CLIENT_ID = Symbol('GoogleClientId');

@Module({
  imports: [UsersModule, PrismaModule, AccessTokenModule, UserAccountModule],
  controllers: [
    SocialAccountLinkController,
    UserAccountController,
    NaverLoginController,
    SocialLoginController,
    SessionController,
    AppleLoginController,
    AuthenticatedUserController,
  ],
  providers: [
    {
      provide: AUTH_CLEANUP_REPOSITORY,
      inject: [PrismaClient],
      useFactory: (client: PrismaClient) =>
        new PrismaAuthCleanupRepository(client),
    },
    {
      provide: CleanupExpiredAuthUseCase,
      inject: [AUTH_CLEANUP_REPOSITORY],
      useFactory: (repository: AuthCleanupRepository) =>
        new CleanupExpiredAuthUseCase(repository),
    },
    {
      provide: AuthCleanupScheduler,
      inject: [CleanupExpiredAuthUseCase],
      useFactory: (cleanup: CleanupExpiredAuthUseCase) =>
        new AuthCleanupScheduler(cleanup),
    },
    {
      provide: LinkSocialAccountUseCase,
      inject: [
        GoogleAuthProvider,
        KakaoAuthProvider,
        NaverAuthProvider,
        AppleAuthProvider,
        USER_ACCOUNT_REPOSITORY,
        NaverLoginFlow,
      ],
      useFactory: (
        google: GoogleAuthProvider,
        kakao: KakaoAuthProvider,
        naver: NaverAuthProvider,
        apple: AppleAuthProvider,
        users: UserAccountRepository,
        flow: NaverLoginFlow,
      ) =>
        new LinkSocialAccountUseCase(
          [google, kakao, naver, apple],
          users,
          flow,
        ),
    },
    {
      provide: NAVER_LOGIN_ATTEMPTS,
      inject: [PrismaClient],
      useFactory: (client: PrismaClient) =>
        new PrismaNaverLoginAttemptRepository(client),
    },
    {
      provide: NaverLoginFlow,
      inject: [NAVER_LOGIN_ATTEMPTS, SocialSignInUseCase],
      useFactory: (
        attempts: NaverLoginAttemptRepository,
        signIn: SocialSignInUseCase,
      ) =>
        new NaverLoginFlow(
          attempts,
          new SecureNaverLogin(() => process.env.NAVER_LOGIN_BRIDGE_KEY ?? ''),
          signIn,
          readNaverLoginSettings,
        ),
    },
    {
      provide: APPLE_LOGIN_ATTEMPT_REPOSITORY,
      inject: [PrismaClient],
      useFactory: (client: PrismaClient) =>
        new PrismaAppleLoginAttemptRepository(client),
    },
    {
      provide: StartAppleLoginUseCase,
      inject: [APPLE_LOGIN_ATTEMPT_REPOSITORY],
      useFactory: (attempts: AppleLoginAttemptRepository) =>
        new StartAppleLoginUseCase(
          attempts,
          new SecureAppleLoginAttemptGenerator(),
        ),
    },
    {
      provide: AppleAuthProvider,
      inject: [APPLE_LOGIN_ATTEMPT_REPOSITORY],
      useFactory: (attempts: AppleLoginAttemptRepository) =>
        new AppleAuthProvider(process.env.APPLE_CLIENT_IDS ?? '', attempts),
    },
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
        AppleAuthProvider,
        FindOrCreateSocialUserUseCase,
      ],
      useFactory: (
        google: GoogleAuthProvider,
        kakao: KakaoAuthProvider,
        naver: NaverAuthProvider,
        apple: AppleAuthProvider,
        users: FindOrCreateSocialUserUseCase,
      ) => new SocialLoginUseCase([google, kakao, naver, apple], users),
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
