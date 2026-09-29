import { SocialAccountKey } from '@users/domain/social-account-key.js';
import { User } from '@users/domain/user.js';

export interface SocialUserRepository {
  findBySocialAccount(key: SocialAccountKey): Promise<User | null>;
  createWithSocialAccount(key: SocialAccountKey): Promise<User>;
}
