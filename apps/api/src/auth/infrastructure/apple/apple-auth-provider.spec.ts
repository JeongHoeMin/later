import { createHash, randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppleAuthProvider } from './apple-auth-provider.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';

describe('AppleAuthProvider', () => {
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;
  let jwks: { keys: Record<string, unknown>[] };
  const http = vi.fn<typeof fetch>();
  const attempts = { create: vi.fn(), consume: vi.fn() };
  const attemptId = randomUUID();
  const nonce = 'server-issued-nonce';
  const now = new Date('2026-10-02T00:00:00Z');
  const seconds = now.getTime() / 1000;
  let adapter: AppleAuthProvider;

  beforeAll(async () => {
    keys = await generateKeyPair('RS256');
    otherKeys = await generateKeyPair('RS256');
    jwks = {
      keys: [
        {
          ...(await exportJWK(keys.publicKey)),
          kid: 'apple-key',
          alg: 'RS256',
          use: 'sig',
        },
      ],
    };
  });
  beforeEach(() => {
    http.mockReset().mockImplementation(async () => Response.json(jwks));
    vi.stubGlobal('fetch', http);
    attempts.consume.mockReset().mockResolvedValue(true);
    adapter = new AppleAuthProvider(
      'com.later.ios,com.later.web',
      attempts,
      () => now,
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function token(
    claims: Record<string, unknown> = {},
    key = keys.privateKey,
    kid = 'apple-key',
  ) {
    return new SignJWT({
      iss: 'https://appleid.apple.com',
      aud: 'com.later.ios',
      exp: seconds + 300,
      sub: 'apple-user',
      nonce,
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .sign(key);
  }

  it.each(['com.later.ios', 'com.later.web'])(
    '허용된 앱 %s의 토큰을 검증하고 시도를 소비한다',
    async (aud) => {
      await expect(
        adapter.authenticate(await token({ aud }), attemptId),
      ).resolves.toEqual({ subject: 'apple-user' });
      expect(attempts.consume).toHaveBeenCalledExactlyOnceWith(
        attemptId,
        createHash('sha256').update(nonce).digest('hex'),
        now,
      );
      expect(http).toHaveBeenCalledExactlyOnceWith(
        'https://appleid.apple.com/auth/keys',
        expect.objectContaining({
          method: 'GET',
          redirect: 'manual',
          signal: expect.any(AbortSignal),
        }),
      );
    },
  );
  it.each([
    { iss: 'https://attacker.test' },
    { aud: 'another-app' },
    { exp: seconds },
    { exp: undefined },
    { sub: '' },
    { sub: undefined },
    { nonce: undefined },
    { nonce: '' },
    { nonce: 123 },
  ])('잘못된 claims %j는 소비 전에 거부한다', async (claims) => {
    await expect(
      adapter.authenticate(await token(claims), attemptId),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    expect(attempts.consume).not.toHaveBeenCalled();
  });
  it('다른 서명과 알려지지 않은 키를 거부한다', async () => {
    await expect(
      adapter.authenticate(await token({}, otherKeys.privateKey), attemptId),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    await expect(
      adapter.authenticate(
        await token({}, keys.privateKey, 'unknown'),
        attemptId,
      ),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    expect(attempts.consume).not.toHaveBeenCalled();
  });
  it('HS256과 잘못된 JWT를 거부한다', async () => {
    const symmetric = await new SignJWT({ sub: 'fake' })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(
        new TextEncoder().encode('attacker-secret-with-more-than-32-bytes'),
      );
    for (const value of [symmetric, 'not-a-token', ''])
      await expect(
        adapter.authenticate(value, attemptId),
      ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    expect(attempts.consume).not.toHaveBeenCalled();
  });
  it.each([undefined, '', 'invalid-uuid'])(
    '잘못된 시도 ID %j는 외부 호출 전에 거부한다',
    async (id) => {
      await expect(
        adapter.authenticate(await token(), id),
      ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
      expect(http).not.toHaveBeenCalled();
    },
  );
  it('불일치·만료·사용된 시도는 인증 실패다', async () => {
    attempts.consume.mockResolvedValue(false);
    await expect(
      adapter.authenticate(await token(), attemptId),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
  });
  it.each([503, 302])('JWKS HTTP %i는 외부 장애다', async (status) => {
    http.mockImplementation(async () =>
      Response.json({ private: 'hidden' }, { status }),
    );
    await expect(
      adapter.authenticate(await token(), attemptId),
    ).rejects.toBeInstanceOf(SocialAuthenticationUnavailableError);
    expect(attempts.consume).not.toHaveBeenCalled();
  });
  it.each([{}, { keys: 'broken' }, 'invalid-json'])(
    '잘못된 JWKS %j는 외부 장애다',
    async (body) => {
      http.mockImplementation(async () =>
        typeof body === 'string' ? new Response(body) : Response.json(body),
      );
      await expect(
        adapter.authenticate(await token(), attemptId),
      ).rejects.toBeInstanceOf(SocialAuthenticationUnavailableError);
    },
  );
  it.each([
    new TypeError('secret token'),
    new DOMException('secret token', 'TimeoutError'),
  ])('통신 실패는 원문 없는 외부 장애다', async (error) => {
    http.mockRejectedValue(error);
    await expect(
      adapter.authenticate(await token(), attemptId),
    ).rejects.toEqual(new SocialAuthenticationUnavailableError());
  });
  it('공개 키를 캐시한다', async () => {
    const signed = await token();
    await adapter.authenticate(signed, attemptId);
    await adapter.authenticate(signed, randomUUID());
    expect(http).toHaveBeenCalledOnce();
  });
  it('키를 가져오는 동안 만료된 토큰은 시도를 소비하지 않는다', async () => {
    let clock = now;
    adapter = new AppleAuthProvider('com.later.ios', attempts, () => clock);
    http.mockImplementation(async () => {
      clock = new Date(now.getTime() + 2_000);
      return Response.json(jwks);
    });
    await expect(
      adapter.authenticate(await token({ exp: seconds + 1 }), attemptId),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    expect(attempts.consume).not.toHaveBeenCalled();
  });
  it('교체된 공개 키는 cooldown 이후 다시 가져온다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    await adapter.authenticate(await token(), attemptId);
    vi.setSystemTime(new Date(now.getTime() + 31_000));
    http.mockImplementation(async () =>
      Response.json({
        keys: [
          {
            ...(await exportJWK(otherKeys.publicKey)),
            kid: 'rotated',
            alg: 'RS256',
            use: 'sig',
          },
        ],
      }),
    );
    await expect(
      adapter.authenticate(
        await token({}, otherKeys.privateKey, 'rotated'),
        randomUUID(),
      ),
    ).resolves.toEqual({ subject: 'apple-user' });
    expect(http).toHaveBeenCalledTimes(2);
  });
  it.each([
    '',
    ' ',
    'com.later.ios,',
    ',com.later.ios',
    'com.later. ios',
    'com.later.ios, com.later.web',
  ])('설정 %j를 거부한다', (value) => {
    expect(() => new AppleAuthProvider(value, attempts)).toThrow(
      'APPLE_CLIENT_IDS',
    );
  });
});
