import { SignJWT, jwtVerify } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JwtAccessToken } from './jwt-access-token.js';
import { InvalidAccessTokenError } from '@auth/domain/errors/invalid-access-token.error.js';

const secret = 'test-only-secret-with-at-least-32-bytes';
const key = new TextEncoder().encode(secret);

async function signedToken(
  claims: Record<string, unknown> = {},
  header = { alg: 'HS256', typ: 'at+jwt' },
  signingKey = key,
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: 'user-123',
    iss: 'later-api',
    aud: 'later-mobile',
    iat: now,
    exp: now + 900,
    ...claims,
  })
    .setProtectedHeader(header)
    .sign(signingKey);
}

describe('JwtAccessToken', () => {
  const tokens = new JwtAccessToken(secret);
  afterEach(() => vi.useRealTimers());

  it('회원 ID로 15분간 유효한 Access Token을 발급한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));
    const result = await tokens.issue('user-123');
    const { payload, protectedHeader } = await jwtVerify(
      result.accessToken,
      key,
      {
        issuer: 'later-api',
        audience: 'later-mobile',
        algorithms: ['HS256'],
        typ: 'at+jwt',
      },
    );
    expect(result).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(payload).toMatchObject({
      sub: 'user-123',
      iat: 1790899200,
      exp: 1790900100,
    });
    expect(protectedHeader).toEqual({ alg: 'HS256', typ: 'at+jwt' });
  });

  it('발급한 토큰에서 인증된 회원 ID를 반환한다', async () => {
    const issued = await tokens.issue('user-123');
    await expect(tokens.verify(issued.accessToken)).resolves.toEqual({
      userId: 'user-123',
    });
  });

  it.each([
    ['만료', { exp: 1 }],
    ['다른 발급자', { iss: 'other-api' }],
    ['다른 대상', { aud: 'other-app' }],
    ['누락된 만료', { exp: undefined }],
    ['누락된 발급 시간', { iat: undefined }],
    ['누락된 회원 ID', { sub: undefined }],
    ['빈 회원 ID', { sub: '   ' }],
    ['잘못된 회원 ID 타입', { sub: 123 }],
    ['미래 발급 시간', { iat: 9999999999 }],
    ['미래 사용 시점', { nbf: 9999999999 }],
  ])('%s 토큰은 거부한다', async (_name, claims) => {
    await expect(
      tokens.verify(await signedToken(claims)),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('다른 키로 서명한 토큰은 거부한다', async () => {
    const forged = await signedToken(
      {},
      undefined,
      new TextEncoder().encode('another-test-secret-with-at-least-32-bytes'),
    );
    await expect(tokens.verify(forged)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it.each([
    { alg: 'HS384', typ: 'at+jwt' },
    { alg: 'HS256', typ: 'JWT' },
  ])('다른 알고리즘 또는 토큰 종류 %j는 거부한다', async (header) => {
    await expect(
      tokens.verify(await signedToken({}, header)),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it.each(['', 'not-a-token', 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEyMyJ9.'])(
    '잘못된 토큰 %j는 거부한다',
    async (token) => {
      await expect(tokens.verify(token)).rejects.toBeInstanceOf(
        InvalidAccessTokenError,
      );
    },
  );

  it.each(['', 'short-secret', ' '.repeat(32)])(
    '안전하지 않은 키 설정은 거부한다: %j',
    (value) => {
      expect(() => new JwtAccessToken(value)).toThrow('ACCESS_TOKEN_SECRET');
    },
  );

  it.each(['', '   '])(
    '빈 회원 ID %j로는 토큰을 발급하지 않는다',
    async (id) => {
      await expect(tokens.issue(id)).rejects.toThrow('회원 ID');
    },
  );
});
