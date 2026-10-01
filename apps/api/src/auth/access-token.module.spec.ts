import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessTokenModule } from './access-token.module.js';

describe('AccessTokenModule', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, '', 'short', ' '.repeat(32)])(
    '잘못된 비밀키 설정 %j는 모듈 구성을 거부한다',
    async (secret) => {
      vi.stubEnv('ACCESS_TOKEN_SECRET', secret);
      await expect(
        Test.createTestingModule({ imports: [AccessTokenModule] })
          .compile()
          .then((module) => module.close()),
      ).rejects.toThrow('ACCESS_TOKEN_SECRET');
    },
  );
});
