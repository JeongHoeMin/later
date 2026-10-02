import type {
  SocialIdentity,
  SocialProvider,
} from '@auth/domain/social-identity.js';

export interface SocialAuthProvider {
  readonly provider: SocialProvider;
  authenticate(credential: string, state?: string): Promise<SocialIdentity>;
}
