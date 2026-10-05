import type {
  AuthOperationsMetrics,
  ProviderOutcome,
} from './auth-operations.metrics.js';
import { SocialAuthenticationFailedError } from '../../domain/errors/social-authentication-failed.error.js';
import type { SocialAuthProvider } from '../../application/ports/social-auth-provider.js';
import type { SocialProvider } from '../../domain/social-identity.js';
import { SocialAuthenticationUnavailableError } from '../../domain/errors/social-authentication-unavailable.error.js';
export function readProviderConcurrency(value?: string): number {
  if (value === undefined) return 10;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100)
    throw new Error('AUTH_PROVIDER_MAX_CONCURRENCY는1~100 정수여야 합니다.');
  return Number(value);
}
export class ProviderConcurrencyGate {
  private readonly active: Record<SocialProvider, number> = {
    google: 0,
    kakao: 0,
    naver: 0,
    apple: 0,
  };
  constructor(
    private readonly limit = 10,
    private readonly metrics?: Pick<
      AuthOperationsMetrics,
      'providerStarted' | 'providerFinished' | 'providerRejected'
    >,
    private readonly now: () => number = () => performance.now(),
  ) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error('제공자 동시 처리 제한이 잘못되었습니다.');
  }
  async run<T>(
    provider: SocialProvider,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.active[provider] >= this.limit) {
      this.observe(() => this.metrics?.providerRejected(provider));
      throw new SocialAuthenticationUnavailableError();
    }
    this.active[provider]++;
    const started = this.now();
    let outcome: ProviderOutcome = 'success';
    this.observe(() => this.metrics?.providerStarted(provider));
    try {
      return await operation();
    } catch (error) {
      outcome =
        error instanceof SocialAuthenticationFailedError
          ? 'invalid'
          : error instanceof SocialAuthenticationUnavailableError
            ? 'unavailable'
            : 'error';
      throw error;
    } finally {
      this.active[provider]--;
      this.observe(() =>
        this.metrics?.providerFinished(provider, outcome, this.now() - started),
      );
    }
  }
  private observe(record: () => void): void {
    try {
      record();
    } catch {
      /* Metrics must not change authentication outcomes. */
    }
  }
}
export class LimitedSocialAuthProvider implements SocialAuthProvider {
  readonly provider: SocialProvider;
  constructor(
    private readonly delegate: SocialAuthProvider,
    private readonly gate: ProviderConcurrencyGate,
  ) {
    this.provider = delegate.provider;
  }
  authenticate(
    credential: string,
    requestContext?: string,
    ownerUserId?: string,
  ) {
    return this.gate.run(this.provider, () =>
      ownerUserId !== undefined
        ? this.delegate.authenticate(credential, requestContext, ownerUserId)
        : requestContext !== undefined
          ? this.delegate.authenticate(credential, requestContext)
          : this.delegate.authenticate(credential),
    );
  }
}
