import type { SocialAccountKey } from '@users/domain/social-account-key.js';
import { SocialAccountConflictError } from '@users/domain/errors/social-account-conflict.error.js';
import { UserNotFoundError } from '@users/domain/errors/user-not-found.error.js';
import { Prisma, type PrismaClient } from '@db/client.js';
import type {
  UserAccountRepository,
  LinkedSocialAccount,
} from '@users/application/ports/user-account.repository.js';
export class PrismaUserAccountRepository implements UserAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async linkSocialAccount(
    userId: string,
    key: SocialAccountKey,
  ): Promise<LinkedSocialAccount> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize linking with other links and withdrawal of this member.
        const members = await tx.$queryRaw<
          { id: string }[]
        >`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
        if (members.length === 0) throw new UserNotFoundError();
        const existing = await this.resolveExisting(tx, userId, key);
        if (existing) return existing;
        const account = await tx.socialAccount.create({
          data: { userId, provider: key.provider, subject: key.subject },
          select: { id: true, provider: true, createdAt: true },
        });
        return {
          id: account.id,
          provider: account.provider,
          linkedAt: account.createdAt,
        };
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Another member may link the same provider subject while our transaction is running.
        const existing = await this.resolveExisting(this.prisma, userId, key);
        if (existing) return existing;
      }
      throw error;
    }
  }
  private async resolveExisting(
    client: Pick<PrismaClient, 'socialAccount'>,
    userId: string,
    key: SocialAccountKey,
  ): Promise<LinkedSocialAccount | null> {
    const account = await client.socialAccount.findUnique({
      where: {
        provider_subject: { provider: key.provider, subject: key.subject },
      },
    });
    if (account) {
      if (account.userId !== userId) throw new SocialAccountConflictError();
      return {
        id: account.id,
        provider: account.provider,
        linkedAt: account.createdAt,
      };
    }
    const slot = await client.socialAccount.findUnique({
      where: { userId_provider: { userId, provider: key.provider } },
    });
    if (slot) throw new SocialAccountConflictError();
    return null;
  }
  async exists(userId: string): Promise<boolean> {
    return (
      (await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })) !== null
    );
  }
  async withdraw(userId: string): Promise<void> {
    // Foreign-key cascades delete all social accounts, sessions and refresh tokens atomically.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({ where: { id: userId } });
    });
  }
  async listSocialAccounts(userId: string): Promise<LinkedSocialAccount[]> {
    const accounts = await this.prisma.socialAccount.findMany({
      where: { userId },
      select: { id: true, provider: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return accounts.map(({ createdAt, ...account }) => ({
      ...account,
      linkedAt: createdAt,
    }));
  }
}
