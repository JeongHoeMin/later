import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecureNaverLogin } from './naver-login-security.js';
import { readNaverLoginSettings } from './naver-login-settings.js';
import { SocialAuthenticationFailedError } from '../../domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '../../domain/errors/social-authentication-unavailable.error.js';
const key = Buffer.alloc(32, 7).toString('base64url');
describe('SecureNaverLogin', () => {
  it('generates independent cryptographic state/proof and stores SHA256 hashes', () => {
    const security = new SecureNaverLogin(() => key);
    const first = security.generate();
    const second = security.generate();
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.attemptSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.state).not.toBe(first.attemptSecret);
    expect(first).not.toEqual(second);
    expect(security.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
  it('encrypts credentials with authenticated encryption and random IVs', () => {
    const security = new SecureNaverLogin(() => key);
    const grant = { code: 'private-code', state: 'private-state' };
    const sealed = security.seal(grant);
    expect(sealed).not.toContain(grant.code);
    expect(sealed).not.toContain(grant.state);
    expect(security.open(sealed)).toEqual(grant);
    expect(security.seal(grant)).not.toBe(sealed);
    expect(security.open(security.seal(null))).toBeNull();
  });
  it('rejects tampering, wrong encryption keys and malformed sealed values', () => {
    const security = new SecureNaverLogin(() => key);
    const sealed = security.seal({ code: 'code', state: 'state' });
    const bytes = Buffer.from(sealed, 'base64url');
    bytes[bytes.length - 1] ^= 1;
    for (const value of [bytes.toString('base64url'), '', 'garbage'])
      expect(() => security.open(value)).toThrow(
        SocialAuthenticationFailedError,
      );
    expect(() =>
      new SecureNaverLogin(() =>
        Buffer.alloc(32, 8).toString('base64url'),
      ).open(sealed),
    ).toThrow(SocialAuthenticationFailedError);
  });
  it.each(['', 'short', Buffer.alloc(31).toString('base64url')])(
    'rejects invalid encryption configuration before generating a start attempt',
    (value) => {
      expect(() => new SecureNaverLogin(() => value).generate()).toThrow(
        SocialAuthenticationUnavailableError,
      );
    },
  );
});
describe('Naver login settings', () => {
  afterEach(() => vi.unstubAllEnvs());
  function configure() {
    vi.stubEnv('NAVER_CLIENT_ID', 'client');
    vi.stubEnv(
      'NAVER_LOGIN_CALLBACK_URL',
      'https://api.example.test/auth/social/naver/callback',
    );
    vi.stubEnv('NAVER_LOGIN_APP_RETURN_URL', 'later://auth/naver');
  }
  it('uses only server-configured destinations', () => {
    configure();
    expect(readNaverLoginSettings()).toEqual({
      clientId: 'client',
      callbackUrl: 'https://api.example.test/auth/social/naver/callback',
      appReturnUrl: 'later://auth/naver',
    });
  });
  it.each([
    '',
    'http://api.example.test/auth/social/naver/callback',
    'https://api.example.test/wrong',
    'https://user:password@api.example.test/auth/social/naver/callback',
    'https://api.example.test/auth/social/naver/callback?next=evil',
  ])('rejects unsafe or wrong callback address %s', (value) => {
    configure();
    vi.stubEnv('NAVER_LOGIN_CALLBACK_URL', value);
    expect(readNaverLoginSettings).toThrow(
      SocialAuthenticationUnavailableError,
    );
  });
  it.each([
    '',
    'javascript:alert(1)',
    'http://app.example.test/auth',
    'https://app.example.test/auth?token=secret',
    'later://user:password@auth/naver',
  ])('rejects unsafe app return address %s', (value) => {
    configure();
    vi.stubEnv('NAVER_LOGIN_APP_RETURN_URL', value);
    expect(readNaverLoginSettings).toThrow(
      SocialAuthenticationUnavailableError,
    );
  });
});
