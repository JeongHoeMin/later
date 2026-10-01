import type {
  AccessTokenIssuer,
  IssuedAccessToken,
} from './ports/access-token.js';
import type { AuthSessionRepository } from './ports/auth-session.repository.js';
import type { RefreshTokenGenerator } from './ports/refresh-token-generator.js';
export type SessionTokens = IssuedAccessToken & { refreshToken: string };
export class IssueSessionUseCase {
  constructor(
    private readonly access: AccessTokenIssuer,
    private readonly refresh: RefreshTokenGenerator,
    private readonly sessions: AuthSessionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async execute(userId: string): Promise<SessionTokens> {
    const access = await this.access.issue(userId);
    const refresh = this.refresh.generate();
    const expiresAt = new Date(this.now().getTime() + 30 * 24 * 60 * 60 * 1000);
    await this.sessions.create({ userId, tokenHash: refresh.hash, expiresAt });
    return { ...access, refreshToken: refresh.token };
  }
}
