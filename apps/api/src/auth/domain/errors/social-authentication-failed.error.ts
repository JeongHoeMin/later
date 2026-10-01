export class SocialAuthenticationFailedError extends Error {
  constructor() {
    super('소셜 인증에 실패했습니다.');
    this.name = 'SocialAuthenticationFailedError';
  }
}
