import type { RefreshTokenGenerator } from '@auth/application/ports/refresh-token-generator.js';
import { randomBytes, createHash } from 'node:crypto';
export class SecureRefreshTokenGenerator implements RefreshTokenGenerator {
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: createHash('sha256').update(token).digest('hex') };
  }
}
