import type { SocialAccountKey } from '@users/domain/social-account-key.js';
export const USER_ACCOUNT_REPOSITORY = Symbol('UserAccountRepository');
export type LinkedSocialAccount = {
  id: string;
  provider: SocialAccountKey['provider'];
  linkedAt: Date;
};
export interface UserAccountRepository {
  linkSocialAccount(
    userId: string,
    key: SocialAccountKey,
  ): Promise<LinkedSocialAccount>;
  exists(userId: string): Promise<boolean>;
  withdraw(userId: string): Promise<void>;
  listSocialAccounts(userId: string): Promise<LinkedSocialAccount[]>;
}
