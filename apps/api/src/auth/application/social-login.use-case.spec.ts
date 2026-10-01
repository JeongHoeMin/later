import { describe, expect, it, vi } from 'vitest';
import { SocialLoginUseCase } from './social-login.use-case.js';
import type { SocialAuthProvider } from './ports/social-auth-provider.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { UnsupportedSocialProviderError } from '@auth/domain/errors/unsupported-social-provider.error.js';

describe('SocialLoginUseCase', () => {
  it.each(['google', 'kakao', 'naver'] as const)(
    '%s 인증을 검증하고 검증된 소셜 계정에 연결된 회원을 반환한다',
    async (provider) => {
      const subject = `${provider}-verified-subject`;
      const providers: SocialAuthProvider[] = [
        {
          provider: 'google',
          authenticate: vi
            .fn()
            .mockResolvedValue({ subject: 'google-verified-subject' }),
        },
        {
          provider: 'kakao',
          authenticate: vi
            .fn()
            .mockResolvedValue({ subject: 'kakao-verified-subject' }),
        },
        {
          provider: 'naver',
          authenticate: vi
            .fn()
            .mockResolvedValue({ subject: 'naver-verified-subject' }),
        },
      ];
      const user = { id: `${provider}-user` };
      const users = { execute: vi.fn().mockResolvedValue(user) };
      const useCase = new SocialLoginUseCase(providers, users);

      expect(
        await useCase.execute({ provider, credential: 'social-credential' }),
      ).toEqual(user);
      expect(users.execute).toHaveBeenCalledExactlyOnceWith({
        provider,
        subject,
      });

      for (const adapter of providers) {
        if (adapter.provider === provider) {
          expect(adapter.authenticate).toHaveBeenCalledExactlyOnceWith(
            'social-credential',
          );
        } else {
          expect(adapter.authenticate).not.toHaveBeenCalled();
        }
      }
    },
  );
  it('소셜 인증에 실패하면 회원 조회와 생성을 실행하지 않는다', async () => {
    const authenticationError = new SocialAuthenticationFailedError();
    const adapter: SocialAuthProvider = {
      provider: 'google',
      authenticate: vi.fn().mockRejectedValue(authenticationError),
    };
    const users = { execute: vi.fn() };
    const useCase = new SocialLoginUseCase([adapter], users);

    await expect(
      useCase.execute({ provider: 'google', credential: 'invalid-credential' }),
    ).rejects.toBe(authenticationError);
    expect(users.execute).not.toHaveBeenCalled();
  });

  it('등록되지 않은 제공자는 다른 제공자로 인증하거나 회원을 처리하지 않는다', async () => {
    const adapter: SocialAuthProvider = {
      provider: 'google',
      authenticate: vi.fn().mockResolvedValue({ subject: 'google-subject' }),
    };
    const users = { execute: vi.fn() };
    const useCase = new SocialLoginUseCase([adapter], users);

    await expect(
      useCase.execute({ provider: 'kakao', credential: 'social-credential' }),
    ).rejects.toBeInstanceOf(UnsupportedSocialProviderError);
    expect(adapter.authenticate).not.toHaveBeenCalled();
    expect(users.execute).not.toHaveBeenCalled();
  });

  it.each(['', '   '])(
    '빈 인증 정보 %j는 제공자 호출 전에 거부한다',
    async (credential) => {
      const adapter: SocialAuthProvider = {
        provider: 'google',
        authenticate: vi.fn().mockResolvedValue({ subject: 'google-subject' }),
      };
      const users = { execute: vi.fn().mockResolvedValue({ id: 'user' }) };
      const useCase = new SocialLoginUseCase([adapter], users);

      await expect(
        useCase.execute({ provider: 'google', credential }),
      ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
      expect(adapter.authenticate).not.toHaveBeenCalled();
      expect(users.execute).not.toHaveBeenCalled();
    },
  );

  it.each(['', '   '])(
    '인증 결과의 subject %j가 비어 있으면 회원을 처리하지 않는다',
    async (subject) => {
      const adapter: SocialAuthProvider = {
        provider: 'naver',
        authenticate: vi.fn().mockResolvedValue({ subject }),
      };
      const users = { execute: vi.fn().mockResolvedValue({ id: 'user' }) };
      const useCase = new SocialLoginUseCase([adapter], users);

      await expect(
        useCase.execute({ provider: 'naver', credential: 'social-credential' }),
      ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
      expect(users.execute).not.toHaveBeenCalled();
    },
  );
});
