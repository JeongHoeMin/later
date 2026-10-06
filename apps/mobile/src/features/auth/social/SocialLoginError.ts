import type { SocialProvider } from '../types';

export type SocialLoginErrorReason =
  'not_configured' | 'failed' | 'rejected' | 'unavailable';

export class SocialLoginError extends Error {
  constructor(
    readonly provider: SocialProvider,
    readonly reason: SocialLoginErrorReason,
    options?: { cause?: unknown },
  ) {
    super(`${provider} login ${reason}`, options);
    this.name = 'SocialLoginError';
  }
}
