import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthOperationsMetrics } from './auth-operations.metrics.js';
import { ProviderConcurrencyGate } from './provider-concurrency-gate.js';
import { AuthCleanupScheduler } from '../cleanup/auth-cleanup.scheduler.js';
import { SocialAuthenticationFailedError } from '../../domain/errors/social-authentication-failed.error.js';
const interval = 5 * 60 * 1000;
const result = {
  appleAttempts: 1,
  naverAttempts: 2,
  sessions: 3,
  rateLimitBuckets: 0,
  batches: 1,
  limitReached: true,
};
function setup() {
  vi.useFakeTimers();
  const logger = { log: vi.fn() };
  const metrics = new AuthOperationsMetrics(logger);
  metrics.onModuleInit();
  return { metrics, logger };
}
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe('운영 집계 로그', () => {
  it('고정 제공자별 결과·시간·진행량을5분마다 한번만 기록한다', async () => {
    const { metrics, logger } = setup();
    metrics.providerStarted('google');
    metrics.providerStarted('google');
    metrics.providerFinished('google', 'success', 10);
    metrics.providerRejected('google');
    metrics.providerFinished('google', 'invalid', 20);
    metrics.providerStarted('naver');
    metrics.providerFinished('naver', 'unavailable', 30);
    expect(logger.log).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(interval);
    expect(logger.log).toHaveBeenCalledOnce();
    const snapshot = logger.log.mock.calls[0]![0];
    expect(snapshot.event).toBe('auth.operations.summary');
    expect(Object.keys(snapshot.providers)).toEqual([
      'google',
      'kakao',
      'naver',
      'apple',
    ]);
    expect(snapshot.providers.google).toMatchObject({
      success: 1,
      invalid: 1,
      busy: 1,
      active: 0,
      peak: 2,
      durationMsTotal: 30,
      durationMsMax: 20,
    });
    expect(snapshot.providers.naver.unavailable).toBe(1);
    await vi.advanceTimersByTimeAsync(interval);
    expect(logger.log).toHaveBeenCalledOnce();
    metrics.onModuleDestroy();
    metrics.onApplicationShutdown();
  });
  it('창이 바뀌어도 진행량과 정리 연속 실패/상한 streak는 유지한다', async () => {
    const { metrics, logger } = setup();
    metrics.providerStarted('apple');
    metrics.cleanupFailed(5);
    metrics.cleanupFailed(10);
    await vi.advanceTimersByTimeAsync(interval);
    expect(logger.log.mock.calls[0]![0].cleanup).toMatchObject({
      runs: 2,
      failures: 2,
      consecutiveFailures: 2,
    });
    metrics.cleanupFinished(result, 7);
    metrics.cleanupFinished(result, 8);
    metrics.providerFinished('apple', 'success', 300001);
    await vi.advanceTimersByTimeAsync(interval);
    expect(logger.log.mock.calls[1]![0].providers.apple).toMatchObject({
      active: 0,
      peak: 1,
      success: 1,
    });
    expect(logger.log.mock.calls[1]![0].cleanup).toMatchObject({
      runs: 2,
      failures: 0,
      consecutiveFailures: 0,
      consecutiveLimits: 2,
      limitReachedRuns: 2,
      appleAttempts: 2,
      sessions: 6,
    });
    metrics.onModuleDestroy();
    metrics.onApplicationShutdown();
  });
  it('종료 시 timer를 중단하고 이후 완료된 작업까지 마지막에 기록한다', async () => {
    const { metrics, logger } = setup();
    metrics.onModuleInit();
    metrics.providerStarted('google');
    metrics.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(interval);
    expect(logger.log).not.toHaveBeenCalled();
    metrics.providerFinished('google', 'success', 5);
    metrics.onApplicationShutdown();
    expect(logger.log).toHaveBeenCalledOnce();
    expect(logger.log.mock.calls[0]![0].providers.google.active).toBe(0);
  });
  it('로그 출력 오류는 인증에 전파되지 않고 다음 주기에 재시도한다', async () => {
    const { metrics, logger } = setup();
    logger.log.mockImplementationOnce(() => {
      throw new Error('private-log-error');
    });
    metrics.providerRejected('google');
    await vi.advanceTimersByTimeAsync(interval);
    await vi.advanceTimersByTimeAsync(interval);
    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log.mock.calls[1]![0].providers.google.busy).toBe(1);
    metrics.onModuleDestroy();
    metrics.onApplicationShutdown();
  });
  it('실제 gate가 결과와 초과를 집계하며 비밀을 저장하지 않는다', async () => {
    const { metrics, logger } = setup();
    let elapsed = 0;
    const gate = new ProviderConcurrencyGate(1, metrics, () => elapsed);
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = gate.run('google', () => waiting);
    await expect(gate.run('google', async () => {})).rejects.toThrow();
    elapsed = 10;
    release();
    await pending;
    await expect(
      gate.run('google', async () => {
        throw new SocialAuthenticationFailedError();
      }),
    ).rejects.toBeInstanceOf(SocialAuthenticationFailedError);
    await expect(
      gate.run('google', async () => {
        throw new Error('private-token');
      }),
    ).rejects.toThrow('private-token');
    metrics.onModuleDestroy();
    metrics.onApplicationShutdown();
    expect(logger.log).toHaveBeenCalled();
    const snapshot = logger.log.mock.calls[0]![0];
    expect(snapshot.providers.google).toMatchObject({
      success: 1,
      invalid: 1,
      error: 1,
      busy: 1,
      active: 0,
      durationMsTotal: 10,
    });
    expect(JSON.stringify(snapshot)).not.toContain('private-token');
  });
  it('지표 기록기 자체가 실패해도 인증과 슬롯 반환을 유지한다', async () => {
    const bad = {
      providerStarted: () => {
        throw new Error('metric-start');
      },
      providerFinished: () => {
        throw new Error('metric-finish');
      },
      providerRejected: () => {
        throw new Error('metric-busy');
      },
    };
    const gate = new ProviderConcurrencyGate(1, bad);
    expect(await gate.run('google', async () => 'first')).toBe('first');
    expect(await gate.run('google', async () => 'second')).toBe('second');
  });
  it('정리 로그 출력 실패를 DB 실패로 중복 집계하지 않는다', async () => {
    const { metrics, logger } = setup();
    const scheduler = new AuthCleanupScheduler(
      { execute: async () => result },
      {
        log: () => {
          throw new Error('log-error');
        },
        error: vi.fn(),
      },
      metrics,
    );
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await scheduler.onModuleDestroy();
    metrics.onModuleDestroy();
    metrics.onApplicationShutdown();
    expect(logger.log.mock.calls[0]![0].cleanup).toMatchObject({
      runs: 1,
      failures: 0,
    });
  });
  it('실제 scheduler의 실패와 다음 성공을 집계한다', async () => {
    const { metrics, logger } = setup();
    const cleanup = {
      execute: vi
        .fn()
        .mockRejectedValueOnce(new Error('private-db'))
        .mockResolvedValue(result),
    };
    const scheduler = new AuthCleanupScheduler(
      cleanup,
      { log: vi.fn(), error: vi.fn() },
      metrics,
    );
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(interval);
    await scheduler.onModuleDestroy();
    metrics.onModuleDestroy();
    metrics.onApplicationShutdown();
    expect(logger.log).toHaveBeenCalled();
    const last = logger.log.mock.calls.at(-1)![0];
    expect(last.cleanup.runs).toBeGreaterThan(0);
    expect(last.cleanup.consecutiveFailures).toBe(0);
  });
});
