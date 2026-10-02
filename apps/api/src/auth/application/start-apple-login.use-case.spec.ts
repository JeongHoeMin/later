import { describe, expect, it, vi } from 'vitest';
import { StartAppleLoginUseCase } from './start-apple-login.use-case.js';
import { SecureAppleLoginAttemptGenerator } from '@auth/infrastructure/apple/secure-apple-login-attempt-generator.js';
import { createHash } from 'node:crypto';

describe('StartAppleLoginUseCase', () => {
  it('무작위 시도와 nonce를 반환하고 해시만 5분간 저장한다', async () => {
    const attempts = {
      create: vi.fn().mockResolvedValue(undefined),
      consume: vi.fn(),
    };
    const now = new Date('2026-10-02T00:00:00Z');
    const useCase = new StartAppleLoginUseCase(
      attempts,
      new SecureAppleLoginAttemptGenerator(),
      () => now,
    );
    const first = await useCase.execute();
    const second = await useCase.execute();
    expect(first).toEqual({
      loginAttemptId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      nonce: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expiresIn: 300,
    });
    expect(second.loginAttemptId).not.toBe(first.loginAttemptId);
    expect(second.nonce).not.toBe(first.nonce);
    expect(attempts.create).toHaveBeenNthCalledWith(1, {
      id: first.loginAttemptId,
      nonceHash: createHash('sha256').update(first.nonce).digest('hex'),
      expiresAt: new Date(now.getTime() + 300_000),
    });
    expect(attempts.create.mock.calls[0][0]).not.toHaveProperty('nonce');
  });

  it('저장이 실패하면 로그인 시도를 반환하지 않는다', async () => {
    const unavailable = new Error('storage unavailable');
    const useCase = new StartAppleLoginUseCase(
      { create: vi.fn().mockRejectedValue(unavailable), consume: vi.fn() },
      new SecureAppleLoginAttemptGenerator(),
    );
    await expect(useCase.execute()).rejects.toBe(unavailable);
  });
});
