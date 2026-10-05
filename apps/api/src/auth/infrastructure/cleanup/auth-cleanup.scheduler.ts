import type { AuthOperationsMetrics } from '../operations/auth-operations.metrics.js';
import {
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { CleanupExpiredAuthUseCase } from '../../application/cleanup-expired-auth.use-case.js';
export class AuthCleanupScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private currentRun?: Promise<void>;
  constructor(
    private readonly cleanup: Pick<CleanupExpiredAuthUseCase, 'execute'>,
    private readonly logger: Pick<Logger, 'log' | 'error'> = new Logger(
      AuthCleanupScheduler.name,
    ),
    private readonly metrics?: Pick<
      AuthOperationsMetrics,
      'cleanupFinished' | 'cleanupFailed'
    >,
  ) {}
  onModuleInit(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.startRun(), 5 * 60 * 1000);
    this.timer.unref();
    this.startRun();
  }
  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.currentRun;
  }
  private startRun(): void {
    if (this.currentRun) return;
    this.currentRun = this.run().finally(() => {
      this.currentRun = undefined;
    });
  }
  private observe(record: () => void): void {
    try {
      record();
    } catch {
      /* Metrics must not affect cleanup. */
    }
  }
  private async run(): Promise<void> {
    const started = performance.now();
    let counts;
    try {
      counts = await this.cleanup.execute();
    } catch {
      this.observe(() =>
        this.metrics?.cleanupFailed(performance.now() - started),
      );
      this.observe(() => this.logger.error({ event: 'auth.cleanup.failed' }));
      return;
    }
    this.observe(() =>
      this.metrics?.cleanupFinished(counts, performance.now() - started),
    );
    this.observe(() =>
      this.logger.log({ event: 'auth.cleanup.completed', ...counts }),
    );
  }
}
