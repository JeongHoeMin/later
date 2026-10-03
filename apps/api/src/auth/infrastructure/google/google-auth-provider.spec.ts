import { generateKeyPairSync, sign } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAuthProvider } from './google-auth-provider.js';
import { createGoogleOAuthClient } from './google-oauth-client.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';

const clientId = 'our-client.apps.googleusercontent.com';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });

// Only Google's public-key download is replaced; JWT verification stays real.
function createClient() {
  const client = new OAuth2Client();
  vi.spyOn(client, 'getFederatedSignonCertsAsync').mockResolvedValue({
    certs: {
      'test-key': keys.publicKey
        .export({ type: 'spki', format: 'pem' })
        .toString(),
    },
    format: 'PEM' as Awaited<
      ReturnType<OAuth2Client['getFederatedSignonCertsAsync']>
    >['format'],
  });
  return client;
}

function token(
  overrides: Record<string, unknown> = {},
  privateKey = keys.privateKey,
) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', kid: 'test-key' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: clientId,
      sub: 'google-user-123',
      iat: now - 60,
      exp: now + 3600,
      ...overrides,
    }),
  ).toString('base64url');
  const content = `${header}.${payload}`;
  return `${content}.${sign('RSA-SHA256', Buffer.from(content), privateKey).toString('base64url')}`;
}

describe('GoogleAuthProvider', () => {
  let provider: GoogleAuthProvider;
  beforeEach(() => {
    provider = new GoogleAuthProvider(clientId, createClient());
  });

  it('검증된 ID 토큰의 sub를 반환한다', async () => {
    await expect(provider.authenticate(token())).resolves.toEqual({
      subject: 'google-user-123',
    });
  });

  it.each([
    ['다른 앱', { aud: 'other-client' }],
    ['잘못된 발급자', { iss: 'https://attacker.example' }],
    ['만료', { iat: 1, exp: 2 }],
    ['누락된 sub', { sub: undefined }],
    ['빈 sub', { sub: '   ' }],
  ])('%s 토큰은 인증 실패로 반환한다', async (_name, claims) => {
    await expect(provider.authenticate(token(claims))).rejects.toBeInstanceOf(
      SocialAuthenticationFailedError,
    );
  });

  it('다른 개인키로 서명한 토큰은 거부한다', async () => {
    const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });
    await expect(
      provider.authenticate(token({}, attacker.privateKey)),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
  });

  it.each(['', '   ', 'not-a-jwt'])(
    '잘못된 토큰 %j는 인증 실패로 반환한다',
    async (credential) => {
      await expect(provider.authenticate(credential)).rejects.toBeInstanceOf(
        SocialAuthenticationFailedError,
      );
    },
  );

  it.each(['', '   '])('빈 Client ID %j는 설정 오류로 거부한다', (id) => {
    expect(() => new GoogleAuthProvider(id)).toThrow();
  });
});

// Preserve SDK certificate transport/cache and signature verification; replace only HTTP.
describe('Google 인증서 통신 경계', () => {
  function setup(http: typeof fetch) {
    const client = createGoogleOAuthClient();
    client.transporter.defaults.fetchImplementation = http;
    return new GoogleAuthProvider(clientId, client);
  }
  const certs = {
    'test-key': keys.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString(),
  };
  const success = () =>
    Response.json(certs, {
      headers: { 'cache-control': 'public, max-age=3600' },
    });
  it('SDK cache를 유지하여 연속 검증에서 인증서를 한번만 요청한다', async () => {
    const http = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => success());
    const value = setup(http);
    expect(await value.authenticate(token())).toEqual({
      subject: 'google-user-123',
    });
    expect(await value.authenticate(token())).toEqual({
      subject: 'google-user-123',
    });
    expect(http).toHaveBeenCalledOnce();
  });
  it('HTTP 장애를 자동 재시도하지 않고503 도메인 오류로 반환한다', async () => {
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ private: 'private-error' }, { status: 503 }),
      )
      .mockImplementation(async () => success());
    await expect(setup(http).authenticate(token())).rejects.toBeInstanceOf(
      SocialAuthenticationUnavailableError,
    );
    expect(http).toHaveBeenCalledOnce();
  });
  it('통신 실패는 JWT 오류와 구분하며 원문을 노출하지 않는다', async () => {
    const http = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('private-network-token'));
    await expect(setup(http).authenticate(token())).rejects.toEqual(
      new SocialAuthenticationUnavailableError(),
    );
    expect(http).toHaveBeenCalledOnce();
  });
  it.each([
    null,
    {},
    [],
    { 'test-key': null },
    { 'test-key': '' },
    { 'test-key': 'not-a-public-key' },
  ])('잘못된 인증서 응답 %j는 제공자 장애다', async (body) => {
    const http = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(body));
    await expect(setup(http).authenticate(token())).rejects.toBeInstanceOf(
      SocialAuthenticationUnavailableError,
    );
  });
  it('잘못된 응답을 cache에 넣지 않아 다음 정상 요청에서 복구한다', async () => {
    const http = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {},
          { headers: { 'cache-control': 'public, max-age=3600' } },
        ),
      )
      .mockImplementation(async () => success());
    const value = setup(http);
    await expect(value.authenticate(token())).rejects.toBeInstanceOf(
      SocialAuthenticationUnavailableError,
    );
    expect(await value.authenticate(token())).toEqual({
      subject: 'google-user-123',
    });
    expect(http).toHaveBeenCalledTimes(2);
  });
  it('HTTP 성공 뒤 잘못된 서명은 기존 인증 실패로 반환한다', async () => {
    const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const http = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => success());
    await expect(
      setup(http).authenticate(token({}, attacker.privateKey)),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
  });
  it('응답이 멈추면 실제 transport signal이5초에 취소되어 재시도 없이 실패한다', async () => {
    const http = vi.fn<typeof fetch>().mockImplementationOnce(
      async (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          const fallback = setTimeout(
            () => reject(new Error('missing-timeout')),
            6000,
          );
          const signal = options?.signal;
          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(fallback);
              reject(signal.reason);
            },
            { once: true },
          );
        }),
    );
    http.mockImplementation(async () => success());
    const started = performance.now();
    await expect(setup(http).authenticate(token())).rejects.toBeInstanceOf(
      SocialAuthenticationUnavailableError,
    );
    expect(performance.now() - started).toBeLessThan(5800);
    expect(http).toHaveBeenCalledOnce();
  }, 8000);
});
