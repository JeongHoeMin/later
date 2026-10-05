import type { NaverLoginSecurity } from '../../application/ports/naver-login-attempt.repository.js';
import {
  randomBytes,
  randomUUID,
  createHash,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { SocialAuthenticationFailedError } from '../../domain/errors/social-authentication-failed.error.js';
import { SocialAuthenticationUnavailableError } from '../../domain/errors/social-authentication-unavailable.error.js';
export class SecureNaverLogin implements NaverLoginSecurity {
  constructor(private readonly keyValue: () => string) {}
  private key(): Buffer {
    const value = this.keyValue();
    if (!/^[A-Za-z0-9_-]{43}$/.test(value))
      throw new SocialAuthenticationUnavailableError();
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.length !== 32 || bytes.toString('base64url') !== value)
      throw new SocialAuthenticationUnavailableError();
    return bytes;
  }
  generate(): { id: string; state: string; attemptSecret: string } {
    this.key();
    return {
      id: randomUUID(),
      state: randomBytes(32).toString('base64url'),
      attemptSecret: randomBytes(32).toString('base64url'),
    };
  }
  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
  seal(value: { code: string; state: string } | null): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from('later.naver.login.v1'));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64url',
    );
  }
  open(value: string): { code: string; state: string } | null {
    const key = this.key();
    try {
      const bytes = Buffer.from(value, 'base64url');
      if (bytes.length < 30 || bytes.toString('base64url') !== value)
        throw new Error();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        bytes.subarray(0, 12),
      );
      decipher.setAAD(Buffer.from('later.naver.login.v1'));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const result: unknown = JSON.parse(
        Buffer.concat([
          decipher.update(bytes.subarray(28)),
          decipher.final(),
        ]).toString('utf8'),
      );
      if (result === null) return null;
      if (
        typeof result !== 'object' ||
        !('code' in result) ||
        typeof result.code !== 'string' ||
        !result.code ||
        /\s/.test(result.code) ||
        !('state' in result) ||
        typeof result.state !== 'string' ||
        !result.state ||
        /\s/.test(result.state)
      )
        throw new Error();
      return { code: result.code, state: result.state };
    } catch {
      throw new SocialAuthenticationFailedError();
    }
  }
}
