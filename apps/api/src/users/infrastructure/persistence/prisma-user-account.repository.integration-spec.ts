import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from 'vitest';
import { PrismaClient } from '@db/client.js';
import { PrismaUserAccountRepository } from './prisma-user-account.repository.js';
import { PrismaAuthSessionRepository } from '@auth/infrastructure/persistence/prisma-auth-session.repository.js';
import { PrismaAppleLoginAttemptRepository } from '@auth/infrastructure/persistence/prisma-apple-login-attempt.repository.js';
import { PrismaNaverLoginAttemptRepository } from '@auth/infrastructure/persistence/prisma-naver-login-attempt.repository.js';
import { SocialAccountConflictError } from '@users/domain/errors/social-account-conflict.error.js';
import { UserNotFoundError } from '@users/domain/errors/user-not-found.error.js';
import { FindOrCreateSocialUserUseCase } from '@users/application/find-or-create-social-user.use-case.js';
import { PrismaSocialUserRepository } from './prisma-social-user.repository.js';

// Real PostgreSQL transactions, constraints and cascade behavior; no ORM mocks.
describe('회원 계정 실제 DB', () => {
  let prisma: PrismaClient;
  let users: PrismaUserAccountRepository;
  let first: string;
  let second: string;
  const createdUsers: string[] = [];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 300000);
  beforeAll(async () => {
    const loaded = config({ path: '.env.test', quiet: true, override: true });
    const url = loaded.parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test')
      throw new Error(
        '통합 테스트는 .env.test의 later_test DB에서만 실행해야 합니다.',
      );
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    await prisma.$connect();
    users = new PrismaUserAccountRepository(prisma);
  });
  beforeEach(async () => {
    first = (await prisma.user.create({ data: {} })).id;
    second = (await prisma.user.create({ data: {} })).id;
    createdUsers.push(first, second);
  });
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    createdUsers.length = 0;
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });
  it('본인 목록만 노출하고 subject 없이 연결 시각을 반환한다', async () => {
    const account = await users.linkSocialAccount(first, {
      provider: 'google',
      subject: randomUUID(),
    });
    await users.linkSocialAccount(second, {
      provider: 'kakao',
      subject: randomUUID(),
    });
    expect(await users.listSocialAccounts(first)).toEqual([account]);
    expect(Object.keys(account).sort()).toEqual(['id', 'linkedAt', 'provider']);
  });
  it('같은 연결을 반복하면 같은 ID이고 해당 소셜로 로그인하면 기존 회원을 반환한다', async () => {
    const key = { provider: 'google' as const, subject: randomUUID() };
    const account = await users.linkSocialAccount(first, key);
    expect(await users.linkSocialAccount(first, key)).toEqual(account);
    const resolver = new FindOrCreateSocialUserUseCase(
      new PrismaSocialUserRepository(prisma),
    );
    expect(await resolver.execute(key)).toEqual({ id: first });
    expect(await prisma.socialAccount.count({ where: { userId: first } })).toBe(
      1,
    );
  });
  it('타 회원의 계정과 같은 제공자의 다른 계정을 거부하고 원래 연결을 보존한다', async () => {
    const key = { provider: 'google' as const, subject: randomUUID() };
    await users.linkSocialAccount(first, key);
    await expect(users.linkSocialAccount(second, key)).rejects.toBeInstanceOf(
      SocialAccountConflictError,
    );
    await expect(
      users.linkSocialAccount(first, {
        provider: 'google',
        subject: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(SocialAccountConflictError);
    expect(await users.listSocialAccounts(second)).toEqual([]);
    expect(await users.listSocialAccounts(first)).toHaveLength(1);
  });
  it('같은 회원의 동일 계정 동시 연동은 모두 같은 연결을 반환한다', async () => {
    const key = { provider: 'apple' as const, subject: randomUUID() };
    const results = await Promise.all([
      users.linkSocialAccount(first, key),
      users.linkSocialAccount(first, key),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await users.listSocialAccounts(first)).toHaveLength(1);
  });
  it('같은 회원의 동일 제공자 다른 계정 동시 연동은 하나만 저장한다', async () => {
    const results = await Promise.allSettled([
      users.linkSocialAccount(first, {
        provider: 'naver',
        subject: randomUUID(),
      }),
      users.linkSocialAccount(first, {
        provider: 'naver',
        subject: randomUUID(),
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected');
    expect(failure?.status === 'rejected' && failure.reason).toBeInstanceOf(
      SocialAccountConflictError,
    );
    expect(await users.listSocialAccounts(first)).toHaveLength(1);
  });
  it('다른 회원이 같은 계정을 동시에 연동해도 하나만 소유한다', async () => {
    const key = { provider: 'google' as const, subject: randomUUID() };
    const results = await Promise.allSettled([
      users.linkSocialAccount(first, key),
      users.linkSocialAccount(second, key),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected');
    expect(failure?.status === 'rejected' && failure.reason).toBeInstanceOf(
      SocialAccountConflictError,
    );
    expect(await prisma.socialAccount.count({ where: key })).toBe(1);
  });
  it('탈퇴는 모든 연결/기기 세션/토큰/연동 시도를 삭제하고 다른 회원은 보존한다', async () => {
    const sessions = new PrismaAuthSessionRepository(prisma);
    const apples = new PrismaAppleLoginAttemptRepository(prisma);
    const navers = new PrismaNaverLoginAttemptRepository(prisma);
    const key = { provider: 'naver' as const, subject: randomUUID() };
    await users.linkSocialAccount(first, key);
    await users.linkSocialAccount(first, {
      provider: 'google',
      subject: randomUUID(),
    });
    const hashes = [
      randomUUID().replaceAll('-', '').padEnd(64, '0'),
      randomUUID().replaceAll('-', '').padEnd(64, '0'),
    ];
    for (const tokenHash of hashes)
      await sessions.create({ userId: first, tokenHash, expiresAt });
    const otherHash = randomUUID().replaceAll('-', '').padEnd(64, '0');
    await sessions.create({ userId: second, tokenHash: otherHash, expiresAt });
    const appleId = randomUUID();
    const naverId = randomUUID();
    await apples.create({
      id: appleId,
      nonceHash: 'a'.repeat(64),
      expiresAt,
      ownerUserId: first,
    });
    await navers.create({
      id: naverId,
      stateHash: randomUUID().padEnd(64, '0'),
      secretHash: 's'.repeat(64),
      expiresAt,
      ownerUserId: first,
    });
    await users.withdraw(first);
    expect(await users.exists(first)).toBe(false);
    expect(await users.exists(second)).toBe(true);
    expect(await users.listSocialAccounts(first)).toEqual([]);
    expect(await prisma.authSession.count({ where: { userId: first } })).toBe(
      0,
    );
    expect(
      await prisma.refreshToken.count({ where: { hash: { in: hashes } } }),
    ).toBe(0);
    expect(
      await prisma.appleLoginAttempt.findUnique({ where: { id: appleId } }),
    ).toBeNull();
    expect(
      await prisma.naverLoginAttempt.findUnique({ where: { id: naverId } }),
    ).toBeNull();
    for (const hash of hashes) {
      expect(await sessions.findUserId(hash)).toBeNull();
      expect(
        await sessions.rotate(hash, randomUUID().padEnd(64, '0'), now),
      ).toBe('invalid');
    }
    expect(await sessions.findUserId(otherHash)).toBe(second);
    const resolver = new FindOrCreateSocialUserUseCase(
      new PrismaSocialUserRepository(prisma),
    );
    const fresh = await resolver.execute(key);
    createdUsers.push(fresh.id);
    expect(fresh.id).not.toBe(first);
  });
  it('존재하지 않는 회원은 연동할 수 없으며 탈퇴 반복은 안전하다', async () => {
    await users.withdraw(first);
    await users.withdraw(first);
    await expect(
      users.linkSocialAccount(first, {
        provider: 'google',
        subject: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
  it('Apple 시도는 일반 로그인/타 회원과 혼용되지 않고 실패 시 소비되지 않는다', async () => {
    const attempts = new PrismaAppleLoginAttemptRepository(prisma);
    const id = randomUUID();
    const nonceHash = 'a'.repeat(64);
    await attempts.create({ id, nonceHash, expiresAt, ownerUserId: first });
    expect(await attempts.consume(id, nonceHash, now)).toBe(false);
    expect(await attempts.consume(id, nonceHash, now, second)).toBe(false);
    expect(await attempts.consume(id, nonceHash, now, first)).toBe(true);
    expect(await attempts.consume(id, nonceHash, now, first)).toBe(false);
    const loginId = randomUUID();
    await attempts.create({ id: loginId, nonceHash, expiresAt });
    try {
      expect(await attempts.consume(loginId, nonceHash, now, first)).toBe(
        false,
      );
      expect(await attempts.consume(loginId, nonceHash, now)).toBe(true);
    } finally {
      await prisma.appleLoginAttempt.deleteMany({ where: { id: loginId } });
    }
  });
  it('Naver 시도는 일반 로그인/타 회원과 혼용되지 않고 실패 시 grant를 보존한다', async () => {
    const attempts = new PrismaNaverLoginAttemptRepository(prisma);
    const id = randomUUID();
    const stateHash = randomUUID().padEnd(64, '0');
    const secretHash = 's'.repeat(64);
    await attempts.create({
      id,
      stateHash,
      secretHash,
      expiresAt,
      ownerUserId: first,
    });
    await attempts.acceptCallback(stateHash, 'sealed-grant', now);
    expect(await attempts.consume(id, secretHash, now)).toBeNull();
    expect(await attempts.consume(id, secretHash, now, second)).toBeNull();
    expect(await attempts.consume(id, secretHash, now, first)).toBe(
      'sealed-grant',
    );
    expect(await attempts.consume(id, secretHash, now, first)).toBeNull();
    const loginId = randomUUID();
    const loginState = randomUUID().padEnd(64, '0');
    await attempts.create({
      id: loginId,
      stateHash: loginState,
      secretHash,
      expiresAt,
    });
    try {
      await attempts.acceptCallback(loginState, 'login-grant', now);
      expect(
        await attempts.consume(loginId, secretHash, now, first),
      ).toBeNull();
      expect(await attempts.consume(loginId, secretHash, now)).toBe(
        'login-grant',
      );
    } finally {
      await prisma.naverLoginAttempt.deleteMany({ where: { id: loginId } });
    }
  });
});
