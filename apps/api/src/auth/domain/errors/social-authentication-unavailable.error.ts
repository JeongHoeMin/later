export class SocialAuthenticationUnavailableError extends Error {
  constructor() {
    super('소셜 인증 서버에 연결할 수 없습니다.');
    this.name = 'SocialAuthenticationUnavailableError';
  }
}
