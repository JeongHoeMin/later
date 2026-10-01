import { generateKeyPairSync, sign } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAuthProvider } from './google-auth-provider.js';
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
