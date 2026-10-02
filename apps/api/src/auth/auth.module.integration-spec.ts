import { config } from 'dotenv';
import { randomUUID, createHash } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi } from 'vitest';
import { PrismaClient } from '@db/client.js';
import { AuthModule } from './auth.module.js';
import { GoogleAuthProvider } from './infrastructure/google/google-auth-provider.js';
import { SocialSignInUseCase } from './application/social-sign-in.use-case.js';
import { RefreshSessionUseCase } from './application/refresh-session.use-case.js';
import { LogoutSessionUseCase } from './application/logout-session.use-case.js';
import { InvalidRefreshTokenError } from './domain/errors/invalid-refresh-token.error.js';
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
} from './application/ports/access-token.js';

describe('AuthModule integration', () => {
  it('같은 소셜 회원에게 별도 세션과 토큰을 발급하고 DB에는 해시만 저장한다', async () => {
    const loaded = config({ path: '.env.test', quiet: true });
    const url = loaded.parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test')
      throw new Error('통합 테스트는 later_test DB에서 실행해야 합니다.');
    vi.stubEnv('DATABASE_URL', url);
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-naver-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-naver-secret');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-only-access-secret-with-at-least-32-bytes',
    );
    const subject = randomUUID();
    let module: TestingModule | undefined;
    let prisma: PrismaClient | undefined;
    try {
      module = await Test.createTestingModule({ imports: [AuthModule] })
        .overrideProvider(GoogleAuthProvider)
        .useValue({
          provider: 'google',
          authenticate: async () => ({ subject }),
        })
        .compile();
      await module.init();
      prisma = module.get<PrismaClient>(PrismaClient);
      const login = module.get(SocialSignInUseCase);
      const first = await login.execute({
        provider: 'google',
        credential: 'id-token',
      });
      const second = await login.execute({
        provider: 'google',
        credential: 'id-token',
      });
      expect(second.user).toEqual(first.user);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      const sessions = await prisma.authSession.findMany({
        where: { userId: first.user.id },
        include: { refreshTokens: true },
      });
      expect(sessions).toHaveLength(2);
      expect(
        sessions.flatMap((s) => s.refreshTokens.map((t) => t.hash)),
      ).toEqual(
        expect.arrayContaining(
          [first, second].map((t) =>
            createHash('sha256').update(t.refreshToken).digest('hex'),
          ),
        ),
      );
      const serialized = JSON.stringify(sessions);
      expect(serialized).not.toContain(first.refreshToken);
      expect(serialized).not.toContain(second.refreshToken);
      await expect(
        module
          .get<AccessTokenVerifier>(ACCESS_TOKEN_VERIFIER)
          .verify(first.accessToken),
      ).resolves.toEqual({ userId: first.user.id });
      const refresh = module.get(RefreshSessionUseCase);
      const renewed = await refresh.execute(first.refreshToken);
      expect(renewed.refreshToken).not.toBe(first.refreshToken);
      await expect(refresh.execute(first.refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      await expect(
        refresh.execute(renewed.refreshToken),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      const other = await refresh.execute(second.refreshToken);
      await module.get(LogoutSessionUseCase).execute(other.refreshToken);
      await expect(refresh.execute(other.refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    } finally {
      try {
        await prisma?.user.deleteMany({
          where: { socialAccounts: { some: { provider: 'google', subject } } },
        });
      } finally {
        await module?.close();
        vi.unstubAllEnvs();
      }
    }
  });
});
