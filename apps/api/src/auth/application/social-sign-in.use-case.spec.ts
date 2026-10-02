import { describe, expect, it, vi } from 'vitest';
import { SocialSignInUseCase } from './social-sign-in.use-case.js';
describe('SocialSignInUseCase', () => {
  it('소셜 인증으로 확인한 회원에게 세션을 발급한다', async () => {
    const social = {
      execute: vi.fn().mockResolvedValue({ id: 'verified-user' }),
    };
    const tokens = {
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    };
    const sessions = { execute: vi.fn().mockResolvedValue(tokens) };
    const useCase = new SocialSignInUseCase(social, sessions);
    const command = { provider: 'google' as const, credential: 'id-token' };
    await expect(useCase.execute(command)).resolves.toEqual({
      user: { id: 'verified-user' },
      ...tokens,
    });
    expect(social.execute).toHaveBeenCalledExactlyOnceWith(command);
    expect(sessions.execute).toHaveBeenCalledExactlyOnceWith('verified-user');
  });
  it('소셜 인증 실패 시 세션을 발급하지 않는다', async () => {
    const error = new Error('authentication failed');
    const sessions = { execute: vi.fn() };
    await expect(
      new SocialSignInUseCase(
        { execute: vi.fn().mockRejectedValue(error) },
        sessions,
      ).execute({ provider: 'google', credential: 'bad' }),
    ).rejects.toBe(error);
    expect(sessions.execute).not.toHaveBeenCalled();
  });
});
