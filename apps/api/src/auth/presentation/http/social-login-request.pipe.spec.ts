import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { SocialLoginRequestPipe } from './social-login-request.pipe.js';

describe('SocialLoginRequestPipe', () => {
  const pipe = new SocialLoginRequestPipe();

  it('구글과 비어 있지 않은 인증 문자열을 반환한다', () => {
    expect(
      pipe.transform({ provider: 'google', credential: 'id-token' }),
    ).toEqual({ provider: 'google', credential: 'id-token' });
  });

  it.each(
    [
      undefined,
      null,
      [],
      'body',
      {},
      { credential: 'id-token' },
      { provider: 'google' },
      { provider: 'google', credential: '' },
      { provider: 'google', credential: '   ' },
      { provider: 'google', credential: null },
      { provider: 'google', credential: 123 },
      { provider: 'kakao', credential: 'id-token' },
      { provider: 'naver', credential: 'id-token' },
      { provider: 'unknown', credential: 'id-token' },
      { provider: 'google', credential: 'id-token', subject: 'client-subject' },
    ].map((body) => [body]),
  )('잘못된 요청 %j는 BadRequestException으로 거부한다', (body) => {
    expect(() => pipe.transform(body)).toThrow(BadRequestException);
  });
});
