import type { PrismaClient } from '@db/client.js';
import type {
  NaverLoginAttempt,
  NaverLoginAttemptRepository,
} from '../../application/ports/naver-login-attempt.repository.js';
export class PrismaNaverLoginAttemptRepository implements NaverLoginAttemptRepository {
  constructor(private readonly client: PrismaClient) {}
  async create(attempt: NaverLoginAttempt): Promise<void> {
    await this.client.naverLoginAttempt.create({ data: attempt });
  }
  async acceptCallback(
    stateHash: string,
    sealedGrant: string,
    now: Date,
  ): Promise<string | null> {
    const rows = await this.client.naverLoginAttempt.updateManyAndReturn({
      where: {
        stateHash,
        expiresAt: { gt: now },
        callbackAt: null,
        usedAt: null,
      },
      data: { sealedGrant, callbackAt: now },
      select: { id: true },
    });
    return rows[0]?.id ?? null;
  }
  async consume(
    id: string,
    secretHash: string,
    now: Date,
    ownerUserId?: string,
  ): Promise<string | null> {
    return this.client.$transaction(async (transaction) => {
      const attempt = await transaction.naverLoginAttempt.findUnique({
        where: { id },
      });
      if (
        !attempt?.sealedGrant ||
        attempt.ownerUserId !== (ownerUserId ?? null) ||
        attempt.secretHash !== secretHash ||
        !attempt.callbackAt ||
        attempt.usedAt ||
        attempt.expiresAt <= now
      )
        return null;
      const updated = await transaction.naverLoginAttempt.updateMany({
        where: {
          id,
          secretHash,
          ownerUserId: ownerUserId ?? null,
          usedAt: null,
          callbackAt: { not: null },
          expiresAt: { gt: now },
        },
        data: { usedAt: now, sealedGrant: null },
      });
      return updated.count === 1 ? attempt.sealedGrant : null;
    });
  }
}
