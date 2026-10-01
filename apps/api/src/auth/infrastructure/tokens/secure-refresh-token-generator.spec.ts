import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SecureRefreshTokenGenerator } from './secure-refresh-token-generator.js';
describe('SecureRefreshTokenGenerator', () => {
  it('32바이트 무작위 토큰과 SHA-256 해시를 생성한다', () => {
    const result = new SecureRefreshTokenGenerator().generate();
    expect(Buffer.from(result.token, 'base64url')).toHaveLength(32);
    expect(result.hash).toBe(
      createHash('sha256').update(result.token).digest('hex'),
    );
    expect(result.hash).not.toBe(result.token);
  });
  it('호출마다 다른 토큰을 생성한다', () => {
    const generator = new SecureRefreshTokenGenerator();
    expect(generator.generate().token).not.toBe(generator.generate().token);
  });
});
