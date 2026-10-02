import { BadRequestException } from '@nestjs/common';
import { describe, it, expect } from 'vitest';
import { RefreshTokenRequestPipe } from './refresh-token-request.pipe.js';
describe('RefreshTokenRequestPipe', () => {
  const pipe = new RefreshTokenRequestPipe();
  it('원문 문자열을 그대로 전달한다', () => {
    expect(pipe.transform({ refreshToken: 'opaque-token' })).toEqual({
      refreshToken: 'opaque-token',
    });
  });
  it.each(
    [
      undefined,
      null,
      [],
      {},
      { refreshToken: '' },
      { refreshToken: '   ' },
      { refreshToken: 123 },
      { refreshToken: 'token', userId: 'untrusted-user' },
    ].map((body) => [body]),
  )('잘못된 본문 %j는 거부한다', (body) => {
    expect(() => pipe.transform(body)).toThrow(BadRequestException);
  });
});
