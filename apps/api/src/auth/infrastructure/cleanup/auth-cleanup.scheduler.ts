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
  ) {}
  onModuleInit(): void {
    if (this.timer) return;
    this.timer = setInterval(
      () => {
        if (this.currentRun) return;
        this.currentRun = this.run().finally(() => {
          this.currentRun = undefined;
        });
      },
      60 * 60 * 1000,
    );
    this.timer.unref();
  }
  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.currentRun;
  }
  private async run(): Promise<void> {
    try {
      const counts = await this.cleanup.execute();
      this.logger.log({ event: 'auth.cleanup.completed', ...counts });
    } catch {
      this.logger.error({ event: 'auth.cleanup.failed' });
    }
  }
}
