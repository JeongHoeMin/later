export class SocialAccountAlreadyExistsError extends Error {
  constructor() {
    super('이미 등록된 소셜 계정입니다.');
    this.name = 'SocialAccountAlreadyExistsError';
  }
}
