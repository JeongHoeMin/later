import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkSocialAccountUseCase } from './link-social-account.use-case.js';
import { SocialAuthenticationFailedError } from '../domain/errors/social-authentication-failed.error.js';
import { UnsupportedSocialProviderError } from '../domain/errors/unsupported-social-provider.error.js';

// Only external providers and persistence boundaries are replaced.
describe('로그인 회원 소셜 계정 연동', () => {
  const linked = {
    id: 'account',
    provider: 'google' as const,
    linkedAt: new Date(),
  };
  const authenticate = vi.fn();
  const linkSocialAccount = vi.fn();
  const consumeGrant = vi.fn();
  beforeEach(() => {
    authenticate.mockReset().mockResolvedValue({ subject: 'verified-subject' });
    linkSocialAccount.mockReset().mockResolvedValue(linked);
    consumeGrant.mockReset().mockResolvedValue({
      provider: 'naver',
      credential: 'server-code',
      state: 'server-state',
    });
  });
  const create = () =>
    new LinkSocialAccountUseCase(
      ['google', 'kakao', 'naver', 'apple'].map((provider) => ({
        provider: provider as 'google' | 'kakao' | 'naver' | 'apple',
        authenticate,
      })),
      { linkSocialAccount },
      { consumeGrant },
    );
  it.each(['google', 'kakao'] as const)(
    '검증된 %s subject만 JWT 본인에게 연결한다',
    async (provider) => {
      expect(
        await create().execute('member', {
          provider,
          credential: 'provider-token',
        }),
      ).toEqual(linked);
      expect(authenticate).toHaveBeenCalledExactlyOnceWith('provider-token');
      expect(linkSocialAccount).toHaveBeenCalledExactlyOnceWith('member', {
        provider,
        subject: 'verified-subject',
      });
    },
  );
  it('Apple 연동 시도는 현재 회원과 함께 검증한다', async () => {
    await create().execute('member', {
      provider: 'apple',
      credential: 'id-token',
      loginAttemptId: 'attempt',
    });
    expect(authenticate).toHaveBeenCalledExactlyOnceWith(
      'id-token',
      'attempt',
      'member',
    );
  });
  it('Naver 연동용 grant를 본인 시도로 소비하고 서버에서 교환한다', async () => {
    await create().execute('member', {
      provider: 'naver',
      loginAttemptId: 'attempt',
      attemptSecret: 'proof',
    });
    expect(consumeGrant).toHaveBeenCalledExactlyOnceWith(
      'attempt',
      'proof',
      'member',
    );
    expect(authenticate).toHaveBeenCalledExactlyOnceWith(
      'server-code',
      'server-state',
    );
  });
  it('인증 실패는 연결하지 않으며 원래 오류를 보존한다', async () => {
    const error = new SocialAuthenticationFailedError();
    authenticate.mockRejectedValue(error);
    await expect(
      create().execute('member', { provider: 'google', credential: 'bad' }),
    ).rejects.toBe(error);
    expect(linkSocialAccount).not.toHaveBeenCalled();
  });
  it('잘못된 외부 subject와 빈 credential을 거부한다', async () => {
    authenticate.mockResolvedValue({ subject: ' ' });
    await expect(
      create().execute('member', { provider: 'google', credential: 'token' }),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    await expect(
      create().execute('member', { provider: 'google', credential: ' ' }),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    expect(linkSocialAccount).not.toHaveBeenCalled();
  });
  it('미지원 제공자는 연결하지 않는다', async () => {
    const service = new LinkSocialAccountUseCase(
      [],
      { linkSocialAccount },
      { consumeGrant },
    );
    await expect(
      service.execute('member', { provider: 'google', credential: 'token' }),
    ).rejects.toBeInstanceOf(UnsupportedSocialProviderError);
  });
  it('충돌이나 DB 오류를 인증 오류로 바꾸지 않는다', async () => {
    const error = new Error('repository-failure');
    linkSocialAccount.mockRejectedValue(error);
    await expect(
      create().execute('member', { provider: 'google', credential: 'token' }),
    ).rejects.toBe(error);
  });
});
