import type { SocialAuthProvider } from './ports/social-auth-provider.js';
import type { SocialUserResolver } from './ports/social-user-resolver.js';
import type { SocialProvider } from '@auth/domain/social-identity.js';
import type { User } from '@users/domain/user.js';
import { SocialAuthenticationFailedError } from '@auth/domain/errors/social-authentication-failed.error.js';
import { UnsupportedSocialProviderError } from '@auth/domain/errors/unsupported-social-provider.error.js';

export type SocialLoginCommand = {
  provider: SocialProvider;
  credential: string;
  state?: string;
};

export class SocialLoginUseCase {
  constructor(
    private readonly providers: readonly SocialAuthProvider[],
    private readonly users: SocialUserResolver,
  ) {}

  async execute(command: SocialLoginCommand): Promise<User> {
    if (!command.credential.trim()) {
      throw new SocialAuthenticationFailedError();
    }

    const adapter = this.providers.find(
      (provider) => provider.provider === command.provider,
    );

    if (!adapter) {
      throw new UnsupportedSocialProviderError();
    }

    const identity = await (command.provider === 'naver'
      ? adapter.authenticate(command.credential, command.state)
      : adapter.authenticate(command.credential));

    if (!identity.subject.trim()) {
      throw new SocialAuthenticationFailedError();
    }

    return this.users.execute({
      provider: adapter.provider,
      subject: identity.subject,
    });
  }
}
