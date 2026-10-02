import type { AppleLoginAttemptRepository } from '@auth/application/ports/apple-login-attempt.repository.js';
import type { SocialIdentity } from '@auth/domain/social-identity.js';
import { isAppleLoginAttemptId } from '@auth/domain/apple-login-attempt.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '@auth/domain/errors/social-authentication-unavailable.error.js';
import {
  createRemoteJWKSet,
  jwtVerify,
  errors,
  type JWTVerifyGetKey,
} from 'jose';
import { createHash } from 'node:crypto';

export class AppleAuthProvider {
  readonly provider = 'apple' as const;
  private readonly audiences: string[];
  private readonly key: JWTVerifyGetKey;

  constructor(
    clientIds: string,
    private readonly attempts: AppleLoginAttemptRepository,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.audiences = clientIds.split(',');
    if (this.audiences.some((id) => !id || /\s/.test(id))) {
      throw new Error(
        'APPLE_CLIENT_IDS는 공백 없는 앱 ID 허용 목록이어야 합니다.',
      );
    }
    const jwks = createRemoteJWKSet(
      new URL('https://appleid.apple.com/auth/keys'),
      { timeoutDuration: 5_000 },
    );
    this.key = async (header, token) => {
      try {
        return await jwks(header, token);
      } catch (error: unknown) {
        if (error instanceof errors.JWKSNoMatchingKey)
          throw new SocialAuthenticationFailedError();
        throw new SocialAuthenticationUnavailableError();
      }
    };
  }

  async authenticate(
    token: string,
    attemptId?: string,
  ): Promise<SocialIdentity> {
    if (!isAppleLoginAttemptId(attemptId))
      throw new SocialAuthenticationFailedError();
    const now = this.now();
    let subject: string;
    let nonce: string;
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience: this.audiences,
        requiredClaims: ['sub', 'exp', 'nonce'],
        currentDate: now,
      });
      if (
        typeof payload.sub !== 'string' ||
        !payload.sub.trim() ||
        typeof payload.nonce !== 'string' ||
        !payload.nonce.trim()
      )
        throw new SocialAuthenticationFailedError();
      // A remote key lookup can outlive the token's remaining lifetime.
      if (
        typeof payload.exp !== 'number' ||
        payload.exp <= this.now().getTime() / 1000
      )
        throw new SocialAuthenticationFailedError();
      subject = payload.sub;
      nonce = payload.nonce;
    } catch (error: unknown) {
      if (error instanceof SocialAuthenticationUnavailableError) throw error;
      if (
        error instanceof errors.JOSEError ||
        error instanceof SocialAuthenticationFailedError
      )
        throw new SocialAuthenticationFailedError();
      throw error;
    }
    const consumed = await this.attempts.consume(
      attemptId,
      createHash('sha256').update(nonce).digest('hex'),
      this.now(),
    );
    if (!consumed) throw new SocialAuthenticationFailedError();
    return { subject };
  }
}
