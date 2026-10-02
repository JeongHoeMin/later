import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { SocialLoginRequestPipe } from './social-login-request.pipe.js';

describe('SocialLoginRequestPipe', () => {
  const pipe = new SocialLoginRequestPipe();
  it('Apple ID 토큰과 서버 로그인 시도 ID를 보존한다', () => {
    const body = {
      provider: 'apple',
      credential: 'id-token',
      loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
    };
    expect(pipe.transform(body)).toEqual(body);
  });
  it.each([
    { provider: 'apple', credential: 'token' },
    { provider: 'apple', credential: 'token', loginAttemptId: 'invalid' },
    {
      provider: 'apple',
      credential: 'token',
      loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
      nonce: 'client-input',
    },
    {
      provider: 'google',
      credential: 'token',
      loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
    },
  ])('잘못된 Apple 입력과 다른 제공자의 시도 ID를 거부한다', (body) => {
    expect(() => pipe.transform(body)).toThrow(BadRequestException);
  });

  it('네이버 서버 시도 입력을 보존한다', () => {
    const body = {
      provider: 'naver',
      loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
      attemptSecret: 'x'.repeat(43),
    };
    expect(pipe.transform(body)).toEqual(body);
  });
  it('네이버 직접 code/state 제출을 거부한다', () => {
    expect(() =>
      pipe.transform({
        provider: 'naver',
        credential: 'code',
        state: 'random-state',
      }),
    ).toThrow(BadRequestException);
  });
  it.each([
    { provider: 'naver', credential: 'code', state: '' },
    { provider: 'naver', credential: 'code', state: 123 },
    { provider: 'naver', credential: 'code', state: 'state', subject: 'fake' },
    { provider: 'google', credential: 'token', state: 'state' },
    { provider: 'kakao', credential: 'token', state: 'state' },
  ])('제공자별 잘못된 state 또는 추가 필드를 거부한다', (body) => {
    expect(() => pipe.transform(body)).toThrow(BadRequestException);
  });

  it('구글과 비어 있지 않은 인증 문자열을 반환한다', () => {
    expect(
      pipe.transform({ provider: 'google', credential: 'id-token' }),
    ).toEqual({ provider: 'google', credential: 'id-token' });
  });

  it('카카오 Access Token과 provider를 그대로 반환한다', () => {
    expect(
      pipe.transform({ provider: 'kakao', credential: 'access-token' }),
    ).toEqual({ provider: 'kakao', credential: 'access-token' });
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
      { provider: 'kakao', credential: '   ' },
      { provider: 'naver', credential: 'id-token' },
      { provider: 'unknown', credential: 'id-token' },
      { provider: 'google', credential: 'id-token', subject: 'client-subject' },
    ].map((body) => [body]),
  )('잘못된 요청 %j는 BadRequestException으로 거부한다', (body) => {
    expect(() => pipe.transform(body)).toThrow(BadRequestException);
  });
});
