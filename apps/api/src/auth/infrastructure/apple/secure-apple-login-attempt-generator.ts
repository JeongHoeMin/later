import type { AppleLoginAttemptGenerator } from '@auth/application/ports/apple-login-attempt.repository.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export class SecureAppleLoginAttemptGenerator implements AppleLoginAttemptGenerator {
  generate(): { id: string; nonce: string; nonceHash: string } {
    const nonce = randomBytes(32).toString('base64url');
    return {
      id: randomUUID(),
      nonce,
      nonceHash: createHash('sha256').update(nonce).digest('hex'),
    };
  }
}
