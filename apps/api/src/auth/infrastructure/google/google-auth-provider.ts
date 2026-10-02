import { OAuth2Client } from 'google-auth-library';
import type { SocialAuthProvider } from '@auth/application/ports/social-auth-provider.js';
import type { SocialIdentity } from '@auth/domain/social-identity.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';

export class GoogleAuthProvider implements SocialAuthProvider {
  readonly provider = 'google' as const;

  constructor(
    private readonly clientId: string,
    private readonly client: OAuth2Client = new OAuth2Client(),
  ) {
    if (!clientId.trim()) {
      throw new Error('Google Client ID가 필요합니다.');
    }
  }

  async authenticate(credential: string): Promise<SocialIdentity> {
    if (!credential.trim()) throw new SocialAuthenticationFailedError();

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: this.clientId,
      });
      const subject = ticket.getPayload()?.sub;
      if (!subject?.trim()) throw new SocialAuthenticationFailedError();
      return { subject };
    } catch {
      throw new SocialAuthenticationFailedError();
    }
  }
}
