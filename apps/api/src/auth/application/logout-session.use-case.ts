import type { RefreshTokenGenerator } from './ports/refresh-token-generator.js';
import type { RefreshSessionRepository } from './ports/refresh-session.repository.js';
export class LogoutSessionUseCase {
  constructor(
    private readonly tokens: RefreshTokenGenerator,
    private readonly sessions: RefreshSessionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async execute(refreshToken: string): Promise<void> {
    await this.sessions.revokeByHash(
      this.tokens.hash(refreshToken),
      this.now(),
    );
  }
}
