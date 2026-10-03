import type {
  SocialIdentity,
  SocialProvider,
} from '@auth/domain/social-identity.js';

export interface SocialAuthProvider {
  readonly provider: SocialProvider;
  // Naver: state; Apple: server-issued loginAttemptId. Other providers omit it.
  authenticate(
    credential: string,
    requestContext?: string,
    ownerUserId?: string,
  ): Promise<SocialIdentity>;
}
