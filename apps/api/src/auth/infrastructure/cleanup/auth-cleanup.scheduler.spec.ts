import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthCleanupScheduler } from './auth-cleanup.scheduler.js';
import { CleanupExpiredAuthUseCase } from '../../application/cleanup-expired-auth.use-case.js';
const hour = 60 * 60 * 1000;
const counts = {
  appleAttempts: 2,
  naverAttempts: 3,
  sessions: 4,
  rateLimitBuckets: 0,
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
  it('시작1시간 후부터 매시간 실행하고 집계만 기록한다', async () => {
    const { scheduler, execute, logger } = setup();
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(hour - 1);
    expect(execute).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith({
      event: 'auth.cleanup.completed',
      ...counts,
    });
    await vi.advanceTimersByTimeAsync(hour);
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
    await vi.advanceTimersByTimeAsync(hour);
    await vi.advanceTimersByTimeAsync(hour);
    expect(execute).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(hour);
    expect(execute).toHaveBeenCalledTimes(2);
    await scheduler.onModuleDestroy();
  });
  it('DB 장애를 원문 없이 기록하고 다음 주기에 재시도한다', async () => {
    const { scheduler, execute, logger } = setup();
    execute.mockRejectedValueOnce(new Error('private-token-db-error'));
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(hour);
    expect(logger.error).toHaveBeenCalledExactlyOnceWith({
      event: 'auth.cleanup.failed',
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'private-token',
    );
    await vi.advanceTimersByTimeAsync(hour);
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
    await vi.advanceTimersByTimeAsync(hour);
    const finished = vi.fn();
    const stopping = scheduler.onModuleDestroy().then(finished);
    await vi.advanceTimersByTimeAsync(hour);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(finished).not.toHaveBeenCalled();
    release();
    await stopping;
    expect(finished).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(hour);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('중복 초기화에도 timer를 하나만 만든다', async () => {
    const { scheduler, execute } = setup();
    scheduler.onModuleInit();
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(hour);
    expect(execute).toHaveBeenCalledTimes(1);
    await scheduler.onModuleDestroy();
  });
});
describe('CleanupExpiredAuthUseCase', () => {
  it('한 실행의 동일한 기준 시각과500개 배치 제한을 저장소에 전달한다', async () => {
    const now = new Date('2026-10-03T00:00:00Z');
    const repository = { deleteExpired: vi.fn().mockResolvedValue(counts) };
    const cleanup = new CleanupExpiredAuthUseCase(repository, () => now);
    expect(await cleanup.execute()).toEqual(counts);
    expect(repository.deleteExpired).toHaveBeenCalledExactlyOnceWith(now, 500);
  });
});
