import {
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { SocialProvider } from '../../domain/social-identity.js';
import type { AuthCleanupRunResult } from '../../application/cleanup-expired-auth.use-case.js';
export type ProviderOutcome = 'success' | 'invalid' | 'unavailable' | 'error';
function providerCounters(active = 0) {
  return {
    active,
    peak: active,
    success: 0,
    invalid: 0,
    unavailable: 0,
    error: 0,
    busy: 0,
    durationMsTotal: 0,
    durationMsMax: 0,
  };
}
function cleanupCounters(consecutiveFailures = 0, consecutiveLimits = 0) {
  return {
    runs: 0,
    failures: 0,
    limitReachedRuns: 0,
    consecutiveFailures,
    consecutiveLimits,
    appleAttempts: 0,
    naverAttempts: 0,
    sessions: 0,
    rateLimitBuckets: 0,
    batches: 0,
    durationMsTotal: 0,
    durationMsMax: 0,
  };
}
export class AuthOperationsMetrics
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private providers: Record<
    SocialProvider,
    ReturnType<typeof providerCounters>
  > = {
    google: providerCounters(),
    kakao: providerCounters(),
    naver: providerCounters(),
    apple: providerCounters(),
  };
  private cleanup = cleanupCounters();
  private dirty = false;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly logger: Pick<Logger, 'log'> = new Logger(
      AuthOperationsMetrics.name,
    ),
  ) {}
  providerStarted(provider: SocialProvider): void {
    const row = this.providers[provider];
    row.active++;
    row.peak = Math.max(row.peak, row.active);
    this.dirty = true;
  }
  providerFinished(
    provider: SocialProvider,
    outcome: ProviderOutcome,
    duration: number,
  ): void {
    const row = this.providers[provider];
    row.active = Math.max(0, row.active - 1);
    row[outcome]++;
    this.duration(row, duration);
    this.dirty = true;
  }
  providerRejected(provider: SocialProvider): void {
    this.providers[provider].busy++;
    this.dirty = true;
  }
  cleanupFinished(result: AuthCleanupRunResult, duration: number): void {
    this.cleanup.runs++;
    this.cleanup.consecutiveFailures = 0;
    this.cleanup.consecutiveLimits = result.limitReached
      ? this.cleanup.consecutiveLimits + 1
      : 0;
    if (result.limitReached) this.cleanup.limitReachedRuns++;
    for (const key of [
      'appleAttempts',
      'naverAttempts',
      'sessions',
      'rateLimitBuckets',
      'batches',
    ] as const)
      this.cleanup[key] += result[key];
    this.duration(this.cleanup, duration);
    this.dirty = true;
  }
  cleanupFailed(duration: number): void {
    this.cleanup.runs++;
    this.cleanup.failures++;
    this.cleanup.consecutiveFailures++;
    this.cleanup.consecutiveLimits = 0;
    this.duration(this.cleanup, duration);
    this.dirty = true;
  }
  private duration(
    row: { durationMsTotal: number; durationMsMax: number },
    elapsed: number,
  ): void {
    const duration = Math.max(0, Math.round(elapsed));
    row.durationMsTotal += duration;
    row.durationMsMax = Math.max(row.durationMsMax, duration);
  }
  onModuleInit(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.emit(), 5 * 60 * 1000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  // Runs after cleanup's module-destroy hook has waited for its in-flight work.
  onApplicationShutdown(): void {
    this.emit();
  }
  private emit(): void {
    if (
      !this.dirty &&
      Object.values(this.providers).every((row) => row.active === 0)
    )
      return;
    try {
      this.logger.log({
        event: 'auth.operations.summary',
        intervalSeconds: 300,
        providers: this.providers,
        cleanup: this.cleanup,
      });
    } catch {
      return;
    }
    this.providers = {
      google: providerCounters(this.providers.google.active),
      kakao: providerCounters(this.providers.kakao.active),
      naver: providerCounters(this.providers.naver.active),
      apple: providerCounters(this.providers.apple.active),
    };
    this.cleanup = cleanupCounters(
      this.cleanup.consecutiveFailures,
      this.cleanup.consecutiveLimits,
    );
    this.dirty = false;
  }
}
