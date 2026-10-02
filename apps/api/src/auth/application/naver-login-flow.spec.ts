import { describe, expect, it, vi } from 'vitest';
import { NaverLoginFlow } from './naver-login-flow.js';
import { SocialAuthenticationFailedError } from '../domain/errors/social-authentication-failed.error.js';
import type { NaverLoginSecurity } from './ports/naver-login-attempt.repository.js';

function setup() {
  const attempts = {
    create: vi.fn().mockResolvedValue(undefined),
    acceptCallback: vi.fn().mockResolvedValue('attempt-id'),
    consume: vi.fn().mockResolvedValue('sealed-grant'),
  };
  const security: NaverLoginSecurity = {
    generate: () => ({
      id: 'attempt-id',
      state: 'state-value',
      attemptSecret: 'private-proof',
    }),
    hash: (value) => `hash:${value}`,
    seal: vi.fn().mockReturnValue('sealed-grant'),
    open: vi.fn().mockReturnValue({ code: 'naver-code', state: 'state-value' }),
  };
  const result = {
    user: { id: 'user' },
    accessToken: 'access',
    refreshToken: 'refresh',
    tokenType: 'Bearer' as const,
    expiresIn: 900,
  };
  const signIn = { execute: vi.fn().mockResolvedValue(result) };
  const now = new Date('2026-10-02T00:00:00Z');
  const flow = new NaverLoginFlow(
    attempts,
    security,
    signIn,
    () => ({
      clientId: 'client',
      callbackUrl: 'https://api.example.test/auth/social/naver/callback',
      appReturnUrl: 'later://auth/naver',
    }),
    () => now,
  );
  return { flow, attempts, security, signIn, result, now };
}
describe('NaverLoginFlow', () => {
  it('creates hashed state/proof and a registered authorization URL for a five-minute attempt', async () => {
    const { flow, attempts } = setup();
    const result = await flow.start();
    expect(result).toMatchObject({
      loginAttemptId: 'attempt-id',
      attemptSecret: 'private-proof',
      expiresIn: 300,
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(
      'https://nid.naver.com/oauth2.0/authorize',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client',
      redirect_uri: 'https://api.example.test/auth/social/naver/callback',
      state: 'state-value',
    });
    expect(attempts.create).toHaveBeenCalledWith({
      id: 'attempt-id',
      stateHash: 'hash:state-value',
      secretHash: 'hash:private-proof',
      expiresAt: new Date('2026-10-02T00:05:00Z'),
    });
  });
  it('seals callback credentials and returns only the attempt identifier to a fixed app URL', async () => {
    const { flow, attempts, security, signIn, now } = setup();
    const url = new URL(await flow.callback('state-value', 'naver-code'));
    expect(security.seal).toHaveBeenCalledWith({
      code: 'naver-code',
      state: 'state-value',
    });
    expect(attempts.acceptCallback).toHaveBeenCalledWith(
      'hash:state-value',
      'sealed-grant',
      now,
    );
    expect(url.toString()).toBe('later://auth/naver?loginAttemptId=attempt-id');
    expect(url.searchParams.has('code')).toBe(false);
    expect(url.searchParams.has('state')).toBe(false);
    expect(url.searchParams.has('attemptSecret')).toBe(false);
    expect(signIn.execute).not.toHaveBeenCalled();
  });
  it('rejects unknown, expired or duplicate callbacks without redirect', async () => {
    const { flow, attempts, signIn } = setup();
    attempts.acceptCallback.mockResolvedValue(null);
    await expect(flow.callback('unknown', 'code')).rejects.toBeInstanceOf(
      SocialAuthenticationFailedError,
    );
    expect(signIn.execute).not.toHaveBeenCalled();
  });
  it('uses the original private proof to consume a callback and invoke existing Naver sign-in', async () => {
    const { flow, attempts, signIn, result, now } = setup();
    await expect(flow.complete('attempt-id', 'private-proof')).resolves.toEqual(
      result,
    );
    expect(attempts.consume).toHaveBeenCalledWith(
      'attempt-id',
      'hash:private-proof',
      now,
    );
    expect(signIn.execute).toHaveBeenCalledWith({
      provider: 'naver',
      credential: 'naver-code',
      state: 'state-value',
    });
  });
  it('rejects mismatched proof, pending, expired or reused attempts before authentication', async () => {
    const { flow, attempts, signIn } = setup();
    attempts.consume.mockResolvedValue(null);
    await expect(flow.complete('attempt-id', 'wrong')).rejects.toBeInstanceOf(
      SocialAuthenticationFailedError,
    );
    expect(signIn.execute).not.toHaveBeenCalled();
  });
  it('stores a cancelled callback and fails completion without provider/DB login', async () => {
    const { flow, security, signIn } = setup();
    await flow.callback('state-value', null);
    expect(security.seal).toHaveBeenCalledWith(null);
    vi.mocked(security.open).mockReturnValue(null);
    await expect(
      flow.complete('attempt-id', 'private-proof'),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    expect(signIn.execute).not.toHaveBeenCalled();
  });
});
