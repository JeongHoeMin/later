import type {
  AuthCleanupRepository,
  AuthCleanupResult,
} from './ports/auth-cleanup.repository.js';
export type AuthCleanupRunResult = AuthCleanupResult & {
  batches: number;
  limitReached: boolean;
};
export class CleanupExpiredAuthUseCase {
  constructor(
    private readonly repository: AuthCleanupRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly elapsedTime: () => number = () => performance.now(),
  ) {}
  async execute(): Promise<AuthCleanupRunResult> {
    const cutoff = this.now();
    const startedAt = this.elapsedTime();
    const result: AuthCleanupRunResult = {
      appleAttempts: 0,
      naverAttempts: 0,
      sessions: 0,
      rateLimitBuckets: 0,
      batches: 0,
      limitReached: false,
    };
    for (let batch = 0; batch < 10; batch++) {
      const counts = await this.repository.deleteExpired(cutoff, 500);
      result.appleAttempts += counts.appleAttempts;
      result.naverAttempts += counts.naverAttempts;
      result.sessions += counts.sessions;
      result.rateLimitBuckets += counts.rateLimitBuckets;
      result.batches++;
      if (Object.values(counts).every((count) => count < 500)) return result;
      if (this.elapsedTime() - startedAt >= 10000) break;
    }
    result.limitReached = true;
    return result;
  }
}
