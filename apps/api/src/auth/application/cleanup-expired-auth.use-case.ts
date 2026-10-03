import type {
  AuthCleanupRepository,
  AuthCleanupResult,
} from './ports/auth-cleanup.repository.js';
export class CleanupExpiredAuthUseCase {
  constructor(
    private readonly repository: AuthCleanupRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async execute(): Promise<AuthCleanupResult> {
    return this.repository.deleteExpired(this.now(), 500);
  }
}
