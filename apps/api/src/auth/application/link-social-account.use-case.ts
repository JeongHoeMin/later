import { SocialAuthenticationFailedError } from '../domain/errors/social-authentication-failed.error.js';
import { UnsupportedSocialProviderError } from '../domain/errors/unsupported-social-provider.error.js';
import type { SocialAuthProvider } from './ports/social-auth-provider.js';
import type { SocialAccountKey } from '@users/domain/social-account-key.js';
import type { LinkedSocialAccount } from '@users/application/ports/user-account.repository.js';
export type LinkSocialAccountCommand =
  | { provider: 'google' | 'kakao'; credential: string }
  | { provider: 'apple'; credential: string; loginAttemptId: string }
  | { provider: 'naver'; loginAttemptId: string; attemptSecret: string };
export class LinkSocialAccountUseCase {
  constructor(
    private readonly providers: readonly SocialAuthProvider[],
    private readonly users: {
      linkSocialAccount(
        userId: string,
        key: SocialAccountKey,
      ): Promise<LinkedSocialAccount>;
    },
    private readonly naver: {
      consumeGrant(
        id: string,
        secret: string,
        userId: string,
      ): Promise<{ provider: 'naver'; credential: string; state: string }>;
    },
  ) {}
  async execute(
    userId: string,
    command: LinkSocialAccountCommand,
  ): Promise<LinkedSocialAccount> {
    const adapter = this.providers.find(
      (provider) => provider.provider === command.provider,
    );
    if (!adapter) throw new UnsupportedSocialProviderError();
    let identity;
    if (command.provider === 'naver') {
      const grant = await this.naver.consumeGrant(
        command.loginAttemptId,
        command.attemptSecret,
        userId,
      );
      identity = await adapter.authenticate(grant.credential, grant.state);
    } else {
      if (!command.credential.trim())
        throw new SocialAuthenticationFailedError();
      identity =
        command.provider === 'apple'
          ? await adapter.authenticate(
              command.credential,
              command.loginAttemptId,
              userId,
            )
          : await adapter.authenticate(command.credential);
    }
    if (!identity.subject.trim()) throw new SocialAuthenticationFailedError();
    return this.users.linkSocialAccount(userId, {
      provider: adapter.provider,
      subject: identity.subject,
    });
  }
}
