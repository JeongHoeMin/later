import type { PrismaClient } from '@db/client.js';
import type {
  AuthSessionRepository,
  NewAuthSession,
} from '@auth/application/ports/auth-session.repository.js';
export class PrismaAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(session: NewAuthSession): Promise<void> {
    await this.prisma.authSession.create({
      data: {
        userId: session.userId,
        expiresAt: session.expiresAt,
        refreshTokens: { create: { hash: session.tokenHash } },
      },
    });
  }
}
