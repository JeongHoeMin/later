export const AUTH_CLEANUP_REPOSITORY = Symbol('AuthCleanupRepository');
export type AuthCleanupResult = {
  appleAttempts: number;
  naverAttempts: number;
  sessions: number;
};
export interface AuthCleanupRepository {
  deleteExpired(now: Date, batchSize: number): Promise<AuthCleanupResult>;
}
