import type { AccessTokenIssuer } from './ports/access-token.js';
import type { RefreshTokenGenerator } from './ports/refresh-token-generator.js';
import type { RefreshSessionRepository } from './ports/refresh-session.repository.js';
import type { SessionTokens } from './issue-session.use-case.js';
import { InvalidRefreshTokenError } from '@auth/domain/errors/invalid-refresh-token.error.js';
export class RefreshSessionUseCase {
  constructor(
    private readonly access: AccessTokenIssuer,
    private readonly tokens: RefreshTokenGenerator,
    private readonly sessions: RefreshSessionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async execute(refreshToken: string): Promise<SessionTokens> {
    const hash = this.tokens.hash(refreshToken);
    const userId = await this.sessions.findUserId(hash);
    if (!userId) throw new InvalidRefreshTokenError();
    // Sign before consuming the old token so a signing failure preserves it.
    const access = await this.access.issue(userId);
    const next = this.tokens.generate();
    const result = await this.sessions.rotate(hash, next.hash, this.now());
    if (result !== 'rotated') throw new InvalidRefreshTokenError();
    return { ...access, refreshToken: next.token };
  }
}
