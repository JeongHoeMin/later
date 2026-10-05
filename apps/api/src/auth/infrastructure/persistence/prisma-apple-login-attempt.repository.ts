import type { PrismaClient } from '@db/client.js';
import type { AppleLoginAttemptRepository } from '@auth/application/ports/apple-login-attempt.repository.js';

export class PrismaAppleLoginAttemptRepository implements AppleLoginAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(attempt: {
    id: string;
    nonceHash: string;
    expiresAt: Date;
    ownerUserId?: string;
  }): Promise<void> {
    await this.prisma.appleLoginAttempt.create({ data: attempt });
  }
  async consume(
    id: string,
    nonceHash: string,
    now: Date,
    ownerUserId?: string,
  ): Promise<boolean> {
    const result = await this.prisma.appleLoginAttempt.updateMany({
      where: {
        id,
        nonceHash,
        ownerUserId: ownerUserId ?? null,
        expiresAt: { gt: now },
        usedAt: null,
      },
      data: { usedAt: now },
    });
    return result.count === 1;
  }
}
