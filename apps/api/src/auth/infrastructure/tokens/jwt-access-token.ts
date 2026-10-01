import type {
  AccessTokenIssuer,
  AccessTokenVerifier,
  AuthenticatedUser,
  IssuedAccessToken,
} from '@auth/application/ports/access-token.js';
import { SignJWT, jwtVerify, errors } from 'jose';
import { InvalidAccessTokenError } from '@auth/domain/errors/invalid-access-token.error.js';
import { randomUUID } from 'node:crypto';

export class JwtAccessToken implements AccessTokenIssuer, AccessTokenVerifier {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    if (!secret.trim() || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error(
        'ACCESS_TOKEN_SECRET은 최소 32바이트의 비밀키여야 합니다.',
      );
    }
    this.key = new TextEncoder().encode(secret);
  }

  async issue(userId: string): Promise<IssuedAccessToken> {
    if (!userId.trim()) throw new Error('회원 ID가 필요합니다.');
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
      .setSubject(userId)
      .setJti(randomUUID())
      .setIssuer('later-api')
      .setAudience('later-mobile')
      .setIssuedAt(now)
      .setExpirationTime(now + 900)
      .sign(this.key);
    return { accessToken, tokenType: 'Bearer', expiresIn: 900 };
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        typ: 'at+jwt',
        issuer: 'later-api',
        audience: 'later-mobile',
        requiredClaims: ['sub', 'iat', 'exp'],
        maxTokenAge: '15m',
      });
      if (typeof payload.sub !== 'string' || !payload.sub.trim())
        throw new InvalidAccessTokenError();
      return { userId: payload.sub };
    } catch (error: unknown) {
      if (error instanceof errors.JOSEError)
        throw new InvalidAccessTokenError();
      throw error;
    }
  }
}
