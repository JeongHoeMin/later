import type { SocialAccountKey } from '@users/domain/social-account-key.js';

export type SocialProvider = SocialAccountKey['provider'];

// Returned only after the provider has verified the supplied credential.
export type SocialIdentity = {
  subject: string;
};
