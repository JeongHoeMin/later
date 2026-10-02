import type { SocialAccountKey } from '@users/domain/social-account-key.js';
import type { User } from '@users/domain/user.js';

export interface SocialUserResolver {
  execute(key: SocialAccountKey): Promise<User>;
}
