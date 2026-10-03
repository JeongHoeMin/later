import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { PrismaClient } from '@db/client.js';
import { AuthModule } from './auth.module.js';
import { AuthCleanupScheduler } from './infrastructure/cleanup/auth-cleanup.scheduler.js';
import { StartAppleLoginUseCase } from './application/start-apple-login.use-case.js';
import { SocialSignInUseCase } from './application/social-sign-in.use-case.js';
import { SocialAuthenticationFailedError } from './domain/errors/social-authentication-failed.error.js';

describe('Apple AuthModule integration', () => {
  it('실제 DI·DB로 nonce를 소비하고 기존 Apple 회원과 새 서비스 세션을 연결한다', async () => {
    const url = config({ path: '.env.test', quiet: true }).parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test')
      throw new Error('통합 테스트는 later_test DB에서 실행해야 합니다.');
    vi.stubEnv('DATABASE_URL', url);
    vi.stubEnv('APPLE_CLIENT_IDS', 'com.later.test');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('KAKAO_APP_ID', '1234');
    vi.stubEnv('NAVER_CLIENT_ID', 'test-client');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-secret');
    vi.stubEnv(
      'ACCESS_TOKEN_SECRET',
      'test-only-secret-with-at-least-32-bytes',
    );
    const subject = randomUUID();
    const preservedAttemptId = randomUUID();
    const ids: string[] = [];
    let module: TestingModule | undefined;
    let prisma: PrismaClient | undefined;
    try {
      const keys = await generateKeyPair('RS256');
      const publicKey = {
        ...(await exportJWK(keys.publicKey)),
        kid: 'integration',
        alg: 'RS256',
        use: 'sig',
      };
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ keys: [publicKey] })),
      );
      module = await Test.createTestingModule({
        imports: [AuthModule],
      })
        // Background cleanup is covered separately and must not delete other test owners' rows.
        .overrideProvider(AuthCleanupScheduler)
        .useValue({})
        .compile();
      prisma = module.get<PrismaClient>(PrismaClient);
      await prisma.appleLoginAttempt.create({
        data: {
          id: preservedAttemptId,
          nonceHash: 'p'.repeat(64),
          expiresAt: new Date(0),
        },
      });
      await module.init();
      expect(
        await prisma.appleLoginAttempt.findUnique({
          where: { id: preservedAttemptId },
        }),
      ).not.toBeNull();
      const db = module.get<PrismaClient>(PrismaClient);
      prisma = db;
      const login = module.get(SocialSignInUseCase);
      async function command() {
        const attempt = await module!.get(StartAppleLoginUseCase).execute();
        ids.push(attempt.loginAttemptId);
        const stored = await prisma!.appleLoginAttempt.findUniqueOrThrow({
          where: { id: attempt.loginAttemptId },
        });
        expect(JSON.stringify(stored)).not.toContain(attempt.nonce);
        const credential = await new SignJWT({ nonce: attempt.nonce })
          .setProtectedHeader({ alg: 'RS256', kid: 'integration' })
          .setSubject(subject)
          .setIssuer('https://appleid.apple.com')
          .setAudience('com.later.test')
          .setExpirationTime('5m')
          .sign(keys.privateKey);
        return {
          provider: 'apple' as const,
          credential,
          loginAttemptId: attempt.loginAttemptId,
        };
      }
      const firstCommand = await command();
      const first = await login.execute(firstCommand);
      const second = await login.execute(await command());
      expect(second.user).toEqual(first.user);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(
        await db.authSession.count({ where: { userId: first.user.id } }),
      ).toBe(2);
      await expect(login.execute(firstCommand)).rejects.toBeInstanceOf(
        SocialAuthenticationFailedError,
      );
      expect(
        await db.authSession.count({ where: { userId: first.user.id } }),
      ).toBe(2);
      expect(
        (
          await db.appleLoginAttempt.findUniqueOrThrow({
            where: { id: ids[0] },
          })
        ).usedAt,
      ).not.toBeNull();
    } finally {
      try {
        if (prisma) {
          await prisma.appleLoginAttempt.deleteMany({
            where: { id: preservedAttemptId },
          });
          await prisma.user.deleteMany({
            where: { socialAccounts: { some: { provider: 'apple', subject } } },
          });
          await prisma.appleLoginAttempt.deleteMany({
            where: { id: { in: ids } },
          });
        }
      } finally {
        await module?.close();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
      }
    }
  });
});
