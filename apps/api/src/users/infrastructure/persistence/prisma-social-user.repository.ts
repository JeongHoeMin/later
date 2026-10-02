import { SocialUserRepository } from '@users/application/ports/social-user.repository.js';
import { Prisma, PrismaClient } from '@db/client.js';
import { SocialAccountKey } from '@users/domain/social-account-key.js';
import { User } from '@users/domain/user.js';
import { SocialAccountAlreadyExistsError } from '@users/domain/errors/social-account-already-exists.error.js';

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

  async createWithSocialAccount(key: SocialAccountKey): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          socialAccounts: {
            create: {
              provider: key.provider,
              subject: key.subject,
            },
          },
        },
        select: {
          id: true,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingUser = await this.findBySocialAccount(key);

        if (existingUser !== null) {
          throw new SocialAccountAlreadyExistsError();
        }
      }

      throw error;
    }
  }
}
