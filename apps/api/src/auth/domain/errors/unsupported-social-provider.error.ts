export class UnsupportedSocialProviderError extends Error {
  constructor() {
    super('등록되지 않은 소셜 인증 제공자입니다.');
    this.name = 'UnsupportedSocialProviderError';
  }
}
