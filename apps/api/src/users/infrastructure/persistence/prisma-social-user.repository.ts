import { SocialUserRepository } from '@users/application/ports/social-user.repository.js';
import { PrismaClient } from '@db/client.js';
import { SocialAccountKey } from '@users/domain/social-account-key.js';
import { User } from '@users/domain/user.js';

export class PrismaSocialUserRepository implements SocialUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySocialAccount(key: SocialAccountKey): Promise<User | null> {
    const account = await this.prisma.socialAccount.findUnique({
      where: {
        provider_subject: {
          provider: key.provider,
          subject: key.subject,
        },
      },
      select: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    return account?.user ?? null;
  }

  createWithSocialAccount(_key: SocialAccountKey): Promise<User> {
    throw new Error('Not implemented');
  }
}
