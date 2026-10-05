import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthCleanupScheduler } from './auth-cleanup.scheduler.js';
import { CleanupExpiredAuthUseCase } from '../../application/cleanup-expired-auth.use-case.js';
const interval = 5 * 60 * 1000;
const counts = {
  appleAttempts: 2,
  naverAttempts: 3,
  sessions: 4,
  rateLimitBuckets: 0,
  batches: 1,
  limitReached: false,
};
function setup() {
  vi.useFakeTimers();
  const execute = vi.fn().mockResolvedValue(counts);
  const logger = { log: vi.fn(), error: vi.fn() };
  const scheduler = new AuthCleanupScheduler({ execute }, logger);
  return { execute, logger, scheduler };
}
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe('AuthCleanupScheduler', () => {
  it('시작 즉시와 이후5분마다 실행하고 집계만 기록한다', async () => {
    const { scheduler, execute, logger } = setup();
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith({
      event: 'auth.cleanup.completed',
      ...counts,
    });
    await vi.advanceTimersByTimeAsync(interval);
    expect(execute).toHaveBeenCalledTimes(2);
    await scheduler.onModuleDestroy();
  });
  it('작업이 진행 중이면 다음 주기를 중복 실행하지 않는다', async () => {
    const { scheduler, execute } = setup();
    let release!: () => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(counts);
        }),
    );
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(interval);
    expect(execute).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(interval);
    expect(execute).toHaveBeenCalledTimes(2);
    await scheduler.onModuleDestroy();
  });
  it('DB 장애를 원문 없이 기록하고 다음 주기에 재시도한다', async () => {
    const { scheduler, execute, logger } = setup();
    execute.mockRejectedValueOnce(new Error('private-token-db-error'));
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    expect(logger.error).toHaveBeenCalledExactlyOnceWith({
      event: 'auth.cleanup.failed',
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'private-token',
    );
    await vi.advanceTimersByTimeAsync(interval);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenCalledWith({
      event: 'auth.cleanup.completed',
      ...counts,
    });
    await scheduler.onModuleDestroy();
  });
  it('종료 시 timer를 없애고 진행 중인 작업이 끝날 때까지 기다린다', async () => {
    const { scheduler, execute } = setup();
    let release!: () => void;
    execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(counts);
        }),
    );
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    const finished = vi.fn();
    const stopping = scheduler.onModuleDestroy().then(finished);
    await vi.advanceTimersByTimeAsync(interval);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(finished).not.toHaveBeenCalled();
    release();
    await stopping;
    expect(finished).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(interval);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('중복 초기화에도 timer를 하나만 만든다', async () => {
    const { scheduler, execute } = setup();
    scheduler.onModuleInit();
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    expect(execute).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(interval);
    expect(execute).toHaveBeenCalledTimes(2);
    await scheduler.onModuleDestroy();
  });
});
const deletedCounts = {
  appleAttempts: 2,
  naverAttempts: 3,
  sessions: 4,
  rateLimitBuckets: 0,
};
describe('CleanupExpiredAuthUseCase', () => {
  it('한 실행의 동일한 기준 시각과500개 배치 제한을 저장소에 전달한다', async () => {
    const now = new Date('2026-10-03T00:00:00Z');
    const repository = {
      deleteExpired: vi.fn().mockResolvedValue(deletedCounts),
    };
    const cleanup = new CleanupExpiredAuthUseCase(repository, () => now);
    expect(await cleanup.execute()).toEqual(counts);
    expect(repository.deleteExpired).toHaveBeenCalledExactlyOnceWith(now, 500);
  });
});

// Repeating only a full table prevents backlog being stranded; empty tables do not keep the run alive.
describe('정리 실행 예산', () => {
  const empty = {
    appleAttempts: 0,
    naverAttempts: 0,
    sessions: 0,
    rateLimitBuckets: 0,
  };
  const full = { ...empty, appleAttempts: 500 };
  it('한 테이블에 남은 배치를 반복하고 동일 cutoff로 집계한다', async () => {
    const cutoff = new Date('2026-10-03T00:00:00Z');
    const repository = {
      deleteExpired: vi
        .fn()
        .mockResolvedValueOnce(full)
        .mockResolvedValueOnce({ ...empty, appleAttempts: 3 }),
    };
    const result = await new CleanupExpiredAuthUseCase(
      repository,
      () => cutoff,
    ).execute();
    expect(result).toEqual({
      ...empty,
      appleAttempts: 503,
      batches: 2,
      limitReached: false,
    });
    expect(repository.deleteExpired.mock.calls).toEqual([
      [cutoff, 500],
      [cutoff, 500],
    ]);
  });
  it('누적 데이터가 계속 남아도10배치에서 멈춘다', async () => {
    const repository = { deleteExpired: vi.fn().mockResolvedValue(full) };
    const result = await new CleanupExpiredAuthUseCase(repository).execute();
    expect(result).toEqual({
      ...empty,
      appleAttempts: 5000,
      batches: 10,
      limitReached: true,
    });
    expect(repository.deleteExpired).toHaveBeenCalledTimes(10);
  });
  it('실행10초가 지나면 진행 중 배치를 집계하고 추가 배치를 시작하지 않는다', async () => {
    let elapsed = 0;
    const repository = {
      deleteExpired: vi.fn().mockImplementation(async () => {
        elapsed += 10000;
        return full;
      }),
    };
    const result = await new CleanupExpiredAuthUseCase(
      repository,
      () => new Date(),
      () => elapsed,
    ).execute();
    expect(result).toEqual({
      ...empty,
      appleAttempts: 500,
      batches: 1,
      limitReached: true,
    });
    expect(repository.deleteExpired).toHaveBeenCalledOnce();
  });
  it('추가 배치 실패를 숨기지 않고 다음 실행에서 새로 시도할 수 있다', async () => {
    const repository = {
      deleteExpired: vi
        .fn()
        .mockResolvedValueOnce(full)
        .mockRejectedValueOnce(new Error('db-error'))
        .mockResolvedValue(empty),
    };
    const cleanup = new CleanupExpiredAuthUseCase(repository);
    await expect(cleanup.execute()).rejects.toThrow('db-error');
    expect(await cleanup.execute()).toEqual({
      ...empty,
      batches: 1,
      limitReached: false,
    });
  });
});
