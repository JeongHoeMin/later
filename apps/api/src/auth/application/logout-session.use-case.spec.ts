import { describe, it, expect, vi } from 'vitest';
import { LogoutSessionUseCase } from './logout-session.use-case.js';
import { SecureRefreshTokenGenerator } from '../infrastructure/tokens/secure-refresh-token-generator.js';
describe('로그아웃 기존 계약', () => {
  it('원문 대신 해시로 해당 세션을 폐기하고 반복 요청도 전달한다', async () => {
    const tokens = new SecureRefreshTokenGenerator();
    const refresh = tokens.generate();
    const now = new Date('2026-10-03T00:00:00Z');
    const revokeByHash = vi.fn().mockResolvedValue(undefined);
    const logout = new LogoutSessionUseCase(
      tokens,
      { revokeByHash, findUserId: vi.fn(), rotate: vi.fn() },
      () => now,
    );
    await logout.execute(refresh.token);
    await logout.execute(refresh.token);
    expect(revokeByHash).toHaveBeenCalledTimes(2);
    expect(revokeByHash).toHaveBeenCalledWith(refresh.hash, now);
    expect(revokeByHash.mock.calls.flat()).not.toContain(refresh.token);
  });
  it('저장소 장애는 성공으로 숨기지 않고 보존한다', async () => {
    const error = new Error('storage-unavailable');
    const tokens = new SecureRefreshTokenGenerator();
    const logout = new LogoutSessionUseCase(tokens, {
      revokeByHash: vi.fn().mockRejectedValue(error),
      findUserId: vi.fn(),
      rotate: vi.fn(),
    });
    await expect(logout.execute(tokens.generate().token)).rejects.toBe(error);
  });
});
