import { describe, expect, it, vi } from 'vitest';
import { NaverAuthProvider } from './naver-auth-provider.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';

const token = {
  access_token: 'naver-token',
  refresh_token: 'unused-refresh',
  token_type: 'bearer',
  expires_in: '3600',
};
const profile = {
  resultcode: '00',
  message: 'success',
  response: { id: 'app-specific-subject' },
};

describe('NaverAuthProvider', () => {
  function setup() {
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(token))
      .mockResolvedValueOnce(Response.json(profile));
    return {
      http,
      provider: new NaverAuthProvider('our-client', 'our-secret', http),
    };
  }

  it('우리 앱으로 인가 코드를 교환하고 프로필의 subject만 반환한다', async () => {
    const { http, provider } = setup();
    await expect(provider.authenticate('code+&=', 'state+&=')).resolves.toEqual(
      { subject: 'app-specific-subject' },
    );
    const [url, options] = http.mock.calls[0];
    expect(url).toBe('https://nid.naver.com/oauth2.0/token');
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(
      Object.fromEntries(new URLSearchParams(String(options?.body))),
    ).toEqual({
      grant_type: 'authorization_code',
      client_id: 'our-client',
      client_secret: 'our-secret',
      code: 'code+&=',
      state: 'state+&=',
    });
    expect(http.mock.calls[1]).toEqual([
      'https://openapi.naver.com/v1/nid/me',
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        headers: { Authorization: 'Bearer naver-token' },
        signal: expect.any(AbortSignal),
      }),
    ]);
  });

  it.each([
    ['', 'state'],
    ['code', undefined],
    ['code', ' '],
    ['code with space', 'state'],
  ])(
    '잘못된 code/state %j %j는 외부 호출 전에 거부한다',
    async (code, state) => {
      const { http, provider } = setup();
      await expect(provider.authenticate(code!, state)).rejects.toBeInstanceOf(
        SocialAuthenticationFailedError,
      );
      expect(http).not.toHaveBeenCalled();
    },
  );

  it.each([
    'invalid_request',
    'unauthorized_client',
    'invalid_grant',
    'access_denied',
  ])('코드 교환 인증 오류 %s는 인증 실패다', async (error) => {
    const { http, provider } = setup();
    http
      .mockReset()
      .mockResolvedValue(
        Response.json({ error, error_description: 'private-code' }),
      );
    await expect(provider.authenticate('code', 'state')).rejects.toBeInstanceOf(
      SocialAuthenticationFailedError,
    );
    expect(http).toHaveBeenCalledOnce();
  });

  it.each([
    [503, { error: 'server_error' }],
    [429, {}],
    [403, {}],
    [200, {}],
    [200, { ...token, access_token: '' }],
    [200, { ...token, token_type: 'mac' }],
    [200, { error: 'unknown', error_description: 'private' }],
  ])('교환 장애 또는 응답 오류 %i %j는 외부 장애다', async (status, body) => {
    const { http, provider } = setup();
    http.mockReset().mockResolvedValue(Response.json(body, { status }));
    await expect(provider.authenticate('code', 'state')).rejects.toBeInstanceOf(
      SocialAuthenticationUnavailableError,
    );
    expect(http).toHaveBeenCalledOnce();
  });

  it.each([0, -1, '0'])(
    '만료된 교환 토큰 %j는 거부한다',
    async (expires_in) => {
      const { http, provider } = setup();
      http
        .mockReset()
        .mockResolvedValue(Response.json({ ...token, expires_in }));
      await expect(
        provider.authenticate('code', 'state'),
      ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    },
  );

  it.each([
    [401, { resultcode: '024' }, SocialAuthenticationFailedError],
    [403, {}, SocialAuthenticationUnavailableError],
    [500, {}, SocialAuthenticationUnavailableError],
    [
      200,
      { resultcode: '00', response: { id: '' } },
      SocialAuthenticationUnavailableError,
    ],
    [
      200,
      { resultcode: '00', response: { id: 123 } },
      SocialAuthenticationUnavailableError,
    ],
    [
      200,
      { resultcode: '99', response: { id: 'fake' } },
      SocialAuthenticationUnavailableError,
    ],
  ])('프로필 오류 %i %j를 분류한다', async (status, body, error) => {
    const { http, provider } = setup();
    http
      .mockReset()
      .mockResolvedValueOnce(Response.json(token))
      .mockResolvedValueOnce(Response.json(body, { status }));
    await expect(provider.authenticate('code', 'state')).rejects.toBeInstanceOf(
      error,
    );
    expect(http).toHaveBeenCalledTimes(2);
  });

  it.each(['token', 'profile'])(
    '%s 통신 실패에 원문을 노출하지 않는다',
    async (stage) => {
      const { http, provider } = setup();
      http.mockReset();
      if (stage === 'profile') http.mockResolvedValueOnce(Response.json(token));
      http.mockRejectedValueOnce(new Error('private credential'));
      await expect(
        provider.authenticate('code', 'state'),
      ).rejects.toBeInstanceOf(SocialAuthenticationUnavailableError);
      expect(http).toHaveBeenCalledTimes(stage === 'profile' ? 2 : 1);
    },
  );

  it.each([
    ['', 'secret'],
    ['client', ' '],
  ])('누락된 앱 설정으로 구성할 수 없다', (clientId, secret) => {
    expect(() => new NaverAuthProvider(clientId, secret)).toThrow(/NAVER_/);
  });
});
