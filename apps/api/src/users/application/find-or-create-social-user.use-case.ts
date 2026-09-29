import { SocialUserRepository } from '@users/application/ports/social-user.repository.js';
import { SocialAccountKey } from '@users/domain/social-account-key.js';
import { User } from '@users/domain/user.js';

export class FindOrCreateSocialUserUseCase {
  constructor(private readonly repository: SocialUserRepository) {}

  async execute(key: SocialAccountKey): Promise<User> {
    const user = await this.repository.findBySocialAccount(key);

    if (user !== null) {
      return user;
    }

    return this.repository.createWithSocialAccount(key);
  }
}
