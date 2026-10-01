import { describe, expect, it, vi } from 'vitest';
import { IssueSessionUseCase } from './issue-session.use-case.js';
import { SecureRefreshTokenGenerator } from '@auth/infrastructure/tokens/secure-refresh-token-generator.js';
import { createHash } from 'node:crypto';
describe('IssueSessionUseCase', () => {
  it('30일 세션에 해시만 저장하고 원문과 Access Token을 반환한다', async () => {
    const access = {
      issue: vi.fn().mockResolvedValue({
        accessToken: 'access',
        tokenType: 'Bearer',
        expiresIn: 900,
      }),
    };
    const sessions = { create: vi.fn().mockResolvedValue(undefined) };
    const useCase = new IssueSessionUseCase(
      access,
      new SecureRefreshTokenGenerator(),
      sessions,
      () => new Date('2026-10-02T00:00:00Z'),
    );
    const result = await useCase.execute('user-123');
    expect(result).toMatchObject({
      accessToken: 'access',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(access.issue).toHaveBeenCalledExactlyOnceWith('user-123');
    expect(sessions.create).toHaveBeenCalledExactlyOnceWith({
      userId: 'user-123',
      tokenHash: createHash('sha256').update(result.refreshToken).digest('hex'),
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    });
    expect(sessions.create.mock.calls[0][0]).not.toHaveProperty('refreshToken');
  });
  it('세션 저장 실패 시 토큰 응답을 반환하지 않는다', async () => {
    const error = new Error('storage failed');
    const useCase = new IssueSessionUseCase(
      {
        issue: vi.fn().mockResolvedValue({
          accessToken: 'access',
          tokenType: 'Bearer',
          expiresIn: 900,
        }),
      },
      new SecureRefreshTokenGenerator(),
      { create: vi.fn().mockRejectedValue(error) },
    );
    await expect(useCase.execute('user')).rejects.toBe(error);
  });
  it('Access Token 발급 실패 시 세션을 저장하지 않는다', async () => {
    const error = new Error('signing failed');
    const sessions = { create: vi.fn() };
    const useCase = new IssueSessionUseCase(
      { issue: vi.fn().mockRejectedValue(error) },
      new SecureRefreshTokenGenerator(),
      sessions,
    );
    await expect(useCase.execute('user')).rejects.toBe(error);
    expect(sessions.create).not.toHaveBeenCalled();
  });
});
