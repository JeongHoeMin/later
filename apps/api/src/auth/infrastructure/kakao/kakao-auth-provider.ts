import type { SocialAuthProvider } from '@auth/application/ports/social-auth-provider.js';
import type { SocialIdentity } from '@auth/domain/social-identity.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';

export class KakaoAuthProvider implements SocialAuthProvider {
  readonly provider = 'kakao' as const;
  private readonly appId: number;

  constructor(
    appId: string,
    private readonly request: typeof fetch = globalThis.fetch,
  ) {
    const normalized = appId.trim();
    const id = Number(normalized);
    if (!/^[1-9]\d*$/.test(normalized) || !Number.isSafeInteger(id)) {
      throw new Error('KAKAO_APP_ID는 양의 안전한 정수여야 합니다.');
    }
    this.appId = id;
  }

  async authenticate(credential: string): Promise<SocialIdentity> {
    if (!credential || /\s/.test(credential)) {
      throw new SocialAuthenticationFailedError();
    }

    try {
      const response = await this.request(
        'https://kapi.kakao.com/v1/user/access_token_info',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${credential}` },
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        },
      );
      if (response.status === 401) throw new SocialAuthenticationFailedError();
      if (response.status === 400) {
        const error: unknown = await response.json();
        if (isRecord(error) && error.code === -2) {
          throw new SocialAuthenticationFailedError();
        }
      }
      if (response.status !== 200) {
        throw new SocialAuthenticationUnavailableError();
      }

      const info: unknown = await response.json();
      if (
        !isRecord(info) ||
        !isPositiveSafeInteger(info.id) ||
        !isPositiveSafeInteger(info.app_id) ||
        typeof info.expires_in !== 'number' ||
        !Number.isSafeInteger(info.expires_in)
      ) {
        throw new SocialAuthenticationUnavailableError();
      }
      if (info.app_id !== this.appId || info.expires_in <= 0) {
        throw new SocialAuthenticationFailedError();
      }
      return { subject: String(info.id) };
    } catch (error: unknown) {
      if (
        error instanceof SocialAuthenticationFailedError ||
        error instanceof SocialAuthenticationUnavailableError
      ) {
        throw error;
      }
      // Do not expose upstream payloads, transport messages, or credentials.
      throw new SocialAuthenticationUnavailableError();
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
