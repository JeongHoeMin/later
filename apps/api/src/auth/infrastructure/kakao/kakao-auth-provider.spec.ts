import { afterEach, describe, expect, it, vi } from 'vitest';
import { KakaoAuthProvider } from './kakao-auth-provider.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';

describe('KakaoAuthProvider', () => {
  const valid = { id: 123456789, app_id: 1234, expires_in: 7199 };
  afterEach(() => vi.restoreAllMocks());

  function setup(body: unknown = valid, status = 200) {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(body, { status }));
    return { request, provider: new KakaoAuthProvider('1234', request) };
  }

  it('검증된 토큰 정보의 회원번호를 subject로 반환한다', async () => {
    const { provider, request } = setup();
    await expect(provider.authenticate('kakao-access-token')).resolves.toEqual({
      subject: '123456789',
    });
    expect(provider.provider).toBe('kakao');
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'https://kapi.kakao.com/v1/user/access_token_info',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer kakao-access-token' },
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each(['', '   ', 'token\nvalue', 'token value'])(
    '잘못된 credential %j는 HTTP 호출 전에 거부한다',
    async (credential) => {
      const { provider, request } = setup();
      await expect(provider.authenticate(credential)).rejects.toBeInstanceOf(
        SocialAuthenticationFailedError,
      );
      expect(request).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ...valid, app_id: 9999 },
    { ...valid, expires_in: 0 },
    { ...valid, expires_in: -1 },
  ])('다른 앱 또는 만료된 토큰 %j를 거부한다', async (body) => {
    await expect(
      setup(body).provider.authenticate('token'),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
  });

  it.each(
    [
      null,
      [],
      {},
      { ...valid, id: '123456789' },
      { ...valid, id: 0 },
      { ...valid, id: -1 },
      { ...valid, id: 1.5 },
      { ...valid, id: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, app_id: '1234' },
      { ...valid, app_id: 0 },
      { ...valid, expires_in: '7199' },
      { ...valid, expires_in: 0.5 },
    ].map((body) => [body]),
  )('잘못된 성공 응답 %j는 인증 불가로 처리한다', async (body) => {
    await expect(
      setup(body).provider.authenticate('token'),
    ).rejects.toBeInstanceOf(SocialAuthenticationUnavailableError);
  });

  it.each([
    [401, { code: -401 }],
    [400, { code: -2 }],
  ])('카카오 %i 토큰 오류는 인증 실패로 처리한다', async (status, body) => {
    await expect(
      setup(body, status).provider.authenticate('token'),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
  });

  it.each([
    [400, { code: -1 }],
    [429, {}],
    [500, {}],
    [503, {}],
    [403, {}],
    [302, {}],
  ])('카카오 %i 장애 응답은 인증 불가로 처리한다', async (status, body) => {
    await expect(
      setup(body, status).provider.authenticate('token'),
    ).rejects.toBeInstanceOf(SocialAuthenticationUnavailableError);
  });

  it.each([
    new TypeError('network details'),
    new DOMException('timed out', 'TimeoutError'),
  ])(
    '통신 실패는 토큰과 내부 내용을 포함하지 않은 인증 불가 오류로 변환한다',
    async (error) => {
      const request = vi.fn<typeof fetch>().mockRejectedValue(error);
      await expect(
        new KakaoAuthProvider('1234', request).authenticate('private-token'),
      ).rejects.toEqual(new SocialAuthenticationUnavailableError());
    },
  );

  it('JSON이 아닌 응답은 인증 불가로 처리한다', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not json', { status: 200 }));
    await expect(
      new KakaoAuthProvider('1234', request).authenticate('token'),
    ).rejects.toBeInstanceOf(SocialAuthenticationUnavailableError);
  });

  it('5초 제한의 AbortSignal을 HTTP 요청에 전달한다', async () => {
    const controller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(controller.signal);
    const request = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(options.signal?.reason),
            { once: true },
          );
        }),
    );
    const operation = new KakaoAuthProvider('1234', request).authenticate(
      'token',
    );
    controller.abort(new DOMException('expired', 'TimeoutError'));
    await expect(operation).rejects.toBeInstanceOf(
      SocialAuthenticationUnavailableError,
    );
    expect(timeout).toHaveBeenCalledExactlyOnceWith(5000);
  });

  it.each([
    '',
    '  ',
    '0',
    '-1',
    '1.5',
    'app-key',
    String(Number.MAX_SAFE_INTEGER + 1),
  ])('잘못된 앱 ID %j는 구성 시 거부한다', (appId) => {
    expect(() => new KakaoAuthProvider(appId)).toThrow('KAKAO_APP_ID');
  });
});
