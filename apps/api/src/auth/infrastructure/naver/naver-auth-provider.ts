import type { SocialIdentity } from '@auth/domain/social-identity.js';
import type { SocialAuthProvider } from '@auth/application/ports/social-auth-provider.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';

export class NaverAuthProvider implements SocialAuthProvider {
  readonly provider = 'naver' as const;
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly request: typeof fetch = globalThis.fetch,
  ) {
    if (!clientId.trim() || /\s/.test(clientId))
      throw new Error('NAVER_CLIENT_ID가 필요합니다.');
    if (!clientSecret.trim() || /\s/.test(clientSecret))
      throw new Error('NAVER_CLIENT_SECRET이 필요합니다.');
  }

  async authenticate(
    credential: string,
    state?: string,
  ): Promise<SocialIdentity> {
    if (!credential || /\s/.test(credential) || !state || /\s/.test(state)) {
      throw new SocialAuthenticationFailedError();
    }
    try {
      const exchange = await this.request(
        'https://nid.naver.com/oauth2.0/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code: credential,
            state,
          }).toString(),
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        },
      );
      if (
        exchange.status !== 200 &&
        exchange.status !== 400 &&
        exchange.status !== 401
      ) {
        throw new SocialAuthenticationUnavailableError();
      }
      const token: unknown = await exchange.json();
      if (!isRecord(token)) throw new SocialAuthenticationUnavailableError();
      if ('error' in token) {
        // Naver documents unauthorized_client as an invalid authorization code.
        if (
          [
            'invalid_request',
            'unauthorized_client',
            'invalid_grant',
            'access_denied',
          ].includes(String(token.error))
        ) {
          throw new SocialAuthenticationFailedError();
        }
        throw new SocialAuthenticationUnavailableError();
      }
      if (
        exchange.status !== 200 ||
        typeof token.access_token !== 'string' ||
        !token.access_token ||
        /\s/.test(token.access_token) ||
        typeof token.token_type !== 'string' ||
        token.token_type.toLowerCase() !== 'bearer'
      ) {
        throw new SocialAuthenticationUnavailableError();
      }
      const expires =
        typeof token.expires_in === 'number'
          ? token.expires_in
          : typeof token.expires_in === 'string' &&
              /^-?\d+$/.test(token.expires_in)
            ? Number(token.expires_in)
            : NaN;
      if (!Number.isSafeInteger(expires))
        throw new SocialAuthenticationUnavailableError();
      if (expires <= 0) throw new SocialAuthenticationFailedError();

      const response = await this.request(
        'https://openapi.naver.com/v1/nid/me',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token.access_token}` },
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        },
      );
      if (response.status === 401) throw new SocialAuthenticationFailedError();
      if (response.status !== 200)
        throw new SocialAuthenticationUnavailableError();
      const profile: unknown = await response.json();
      if (
        !isRecord(profile) ||
        profile.resultcode !== '00' ||
        !isRecord(profile.response) ||
        typeof profile.response.id !== 'string' ||
        !profile.response.id.trim()
      ) {
        throw new SocialAuthenticationUnavailableError();
      }
      return { subject: profile.response.id };
    } catch (error: unknown) {
      if (
        error instanceof SocialAuthenticationFailedError ||
        error instanceof SocialAuthenticationUnavailableError
      )
        throw error;
      throw new SocialAuthenticationUnavailableError();
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
