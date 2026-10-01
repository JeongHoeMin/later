import { describe, expect, it, vi } from 'vitest';
import { RefreshSessionUseCase } from './refresh-session.use-case.js';
import { LogoutSessionUseCase } from './logout-session.use-case.js';
import { SecureRefreshTokenGenerator } from '@auth/infrastructure/tokens/secure-refresh-token-generator.js';
import { InvalidRefreshTokenError } from '@auth/domain/errors/invalid-refresh-token.error.js';

const tokens = new SecureRefreshTokenGenerator();
const original = tokens.generate();
const now = new Date('2026-10-02T00:00:00Z');
function setup() {
  const access = {
    issue: vi.fn().mockResolvedValue({
      accessToken: 'access',
      tokenType: 'Bearer',
      expiresIn: 900,
    }),
  };
  const sessions = {
    findUserId: vi.fn().mockResolvedValue('verified-user'),
    rotate: vi.fn().mockResolvedValue('rotated'),
    revokeByHash: vi.fn().mockResolvedValue(undefined),
  };
  return {
    access,
    sessions,
    useCase: new RefreshSessionUseCase(access, tokens, sessions, () => now),
  };
}
describe('RefreshSessionUseCase', () => {
  it('저장된 회원 ID로 새 토큰을 발급하고 원문 대신 해시로 교체한다', async () => {
    const { useCase, access, sessions } = setup();
    const result = await useCase.execute(original.token);
    expect(result).toMatchObject({
      accessToken: 'access',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(result.refreshToken).not.toBe(original.token);
    expect(access.issue).toHaveBeenCalledExactlyOnceWith('verified-user');
    expect(sessions.findUserId).toHaveBeenCalledExactlyOnceWith(original.hash);
    expect(sessions.rotate).toHaveBeenCalledExactlyOnceWith(
      original.hash,
      tokens.hash(result.refreshToken),
      now,
    );
  });
  it('알 수 없는 토큰은 발급이나 교체 전에 거부한다', async () => {
    const { useCase, sessions, access } = setup();
    sessions.findUserId.mockResolvedValue(null);
    await expect(useCase.execute(original.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(access.issue).not.toHaveBeenCalled();
    expect(sessions.rotate).not.toHaveBeenCalled();
  });
  it.each(['invalid', 'reused'])(
    '원자적 교체 결과가 %s이면 토큰을 반환하지 않는다',
    async (result) => {
      const { useCase, sessions } = setup();
      sessions.rotate.mockResolvedValue(result);
      await expect(useCase.execute(original.token)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    },
  );
  it('서명 실패 시 기존 Refresh Token을 소비하지 않는다', async () => {
    const { useCase, sessions, access } = setup();
    const error = new Error('signing failed');
    access.issue.mockRejectedValue(error);
    await expect(useCase.execute(original.token)).rejects.toBe(error);
    expect(sessions.rotate).not.toHaveBeenCalled();
  });
  it('DB 오류를 인증 실패로 바꾸지 않는다', async () => {
    const { useCase, sessions } = setup();
    const error = new Error('DB failed');
    sessions.rotate.mockRejectedValue(error);
    await expect(useCase.execute(original.token)).rejects.toBe(error);
  });
});
describe('LogoutSessionUseCase', () => {
  it('Refresh Token 해시에 연결된 세션을 폐기한다', async () => {
    const { sessions } = setup();
    await new LogoutSessionUseCase(tokens, sessions, () => now).execute(
      original.token,
    );
    expect(sessions.revokeByHash).toHaveBeenCalledExactlyOnceWith(
      original.hash,
      now,
    );
  });
});
