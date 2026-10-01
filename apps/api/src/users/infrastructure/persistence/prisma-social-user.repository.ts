import { SocialUserRepository } from '@users/application/ports/social-user.repository.js';
import { PrismaClient } from '@db/client.js';
import { SocialAccountKey } from '@users/domain/social-account-key.js';
import { User } from '@users/domain/user.js';

export class PrismaSocialUserRepository implements SocialUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findBySocialAccount(_key: SocialAccountKey): Promise<User | null> {
    throw new Error('Not implemented');
  }

  createWithSocialAccount(_key: SocialAccountKey): Promise<User> {
    throw new Error('Not implemented');
  }
}
