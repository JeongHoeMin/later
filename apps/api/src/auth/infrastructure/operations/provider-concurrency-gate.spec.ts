import { describe, it, expect } from 'vitest';
import {
  ProviderConcurrencyGate,
  LimitedSocialAuthProvider,
  readProviderConcurrency,
} from './provider-concurrency-gate.js';
import { SocialAuthenticationUnavailableError } from '../../domain/errors/social-authentication-unavailable.error.js';
function held() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
describe('제공자별 동시 처리', () => {
  it('기본10개까지만 처리하고11번째는 operation을 시작하지 않는다', async () => {
    const gate = new ProviderConcurrencyGate();
    const waiting = held();
    const pending = Array.from({ length: 10 }, () =>
      gate.run('google', () => waiting.promise),
    );
    let called = false;
    try {
      await expect(
        gate.run('google', async () => {
          called = true;
        }),
      ).rejects.toBeInstanceOf(SocialAuthenticationUnavailableError);
      expect(called).toBe(false);
    } finally {
      waiting.release();
      await Promise.all(pending);
    }
  });
  it('성공/실패 모두 슬롯을 반환하고 다른 제공자는 독립적이다', async () => {
    const gate = new ProviderConcurrencyGate(1);
    const waiting = held();
    const pending = gate.run('google', () => waiting.promise);
    expect(await gate.run('kakao', async () => 'kakao')).toBe('kakao');
    waiting.release();
    await pending;
    await expect(
      gate.run('google', async () => {
        throw new Error('failure');
      }),
    ).rejects.toThrow('failure');
    expect(await gate.run('google', async () => 'recovered')).toBe('recovered');
  });
  it('로그인/연동 wrapper가 같은 gate를 공유하고 입력 context를 그대로 전달한다', async () => {
    const gate = new ProviderConcurrencyGate(1);
    const waiting = held();
    let calls = 0;
    const delegate = {
      provider: 'apple' as const,
      authenticate: async (
        credential: string,
        context?: string,
        owner?: string,
      ) => {
        calls++;
        expect([credential, context, owner]).toEqual([
          'token',
          'attempt',
          'owner',
        ]);
        await waiting.promise;
        return { subject: 'verified' };
      },
    };
    const login = new LimitedSocialAuthProvider(delegate, gate);
    const link = new LimitedSocialAuthProvider(delegate, gate);
    const pending = login.authenticate('token', 'attempt', 'owner');
    try {
      await expect(
        link.authenticate('token', 'attempt', 'owner'),
      ).rejects.toBeInstanceOf(SocialAuthenticationUnavailableError);
      expect(calls).toBe(1);
    } finally {
      waiting.release();
      expect(await pending).toEqual({ subject: 'verified' });
    }
  });
  it('미설정은10이며 명시적인1~100 설정은 적용한다', () => {
    expect(readProviderConcurrency()).toBe(10);
    expect(readProviderConcurrency('1')).toBe(1);
    expect(readProviderConcurrency('100')).toBe(100);
  });
  it.each(['', '0', '-1', '1.5', '101', 'garbage'])(
    '잘못된 설정 %s는 시작 시 거부한다',
    (value) => {
      expect(() => readProviderConcurrency(value)).toThrow();
    },
  );
});
