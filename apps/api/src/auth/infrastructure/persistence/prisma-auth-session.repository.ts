import type { PrismaClient } from '@db/client.js';
import type {
  AuthSessionRepository,
  NewAuthSession,
} from '@auth/application/ports/auth-session.repository.js';
import type {
  RefreshSessionRepository,
  RotationResult,
} from '@auth/application/ports/refresh-session.repository.js';
export class PrismaAuthSessionRepository
  implements AuthSessionRepository, RefreshSessionRepository
{
  constructor(private readonly prisma: PrismaClient) {}
  async findUserId(hash: string): Promise<string | null> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { hash },
      select: { session: { select: { userId: true } } },
    });
    return token?.session.userId ?? null;
  }
  async rotate(
    hash: string,
    nextHash: string,
    now: Date,
  ): Promise<RotationResult> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.refreshToken.findUnique({
        where: { hash },
        select: { sessionId: true },
      });
      if (!token) return 'invalid';
      // Lock the session, then re-read state to serialize rotation and logout.
      await tx.$queryRaw`SELECT "id" FROM "AuthSession" WHERE "id" = ${token.sessionId}::uuid FOR UPDATE`;
      const current = await tx.refreshToken.findUnique({
        where: { hash },
        include: { session: true },
      });
      if (
        !current ||
        current.session.revokedAt ||
        current.session.expiresAt <= now
      )
        return 'invalid';
      if (current.usedAt) {
        await tx.authSession.update({
          where: { id: current.sessionId },
          data: { revokedAt: now },
        });
        // Return instead of throwing so revocation commits before the HTTP 401.
        return 'reused';
      }
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { usedAt: now },
      });
      await tx.refreshToken.create({
        data: { sessionId: current.sessionId, hash: nextHash },
      });
      return 'rotated';
    });
  }
  async revokeByHash(hash: string, now: Date): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { revokedAt: null, refreshTokens: { some: { hash } } },
      data: { revokedAt: now },
    });
  }
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
