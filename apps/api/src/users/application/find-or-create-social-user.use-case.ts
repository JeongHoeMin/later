import { SocialUserRepository } from '@users/application/ports/social-user.repository.js';
import { SocialAccountKey } from '@users/domain/social-account-key.js';
import { User } from '@users/domain/user.js';
import { SocialAccountAlreadyExistsError } from '@users/domain/errors/social-account-already-exists.error.js';

export class FindOrCreateSocialUserUseCase {
  constructor(private readonly repository: SocialUserRepository) {}

  async execute(key: SocialAccountKey): Promise<User> {
    const user = await this.repository.findBySocialAccount(key);

    if (user !== null) {
      return user;
    }

    try {
      return await this.repository.createWithSocialAccount(key);
    } catch (error: unknown) {
      if (error instanceof SocialAccountAlreadyExistsError) {
        const existingUser = await this.repository.findBySocialAccount(key);

        if (existingUser !== null) {
          return existingUser;
        }
      }

      throw error;
    }
  }
}
