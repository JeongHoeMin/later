export class SocialAccountConflictError extends Error {
  constructor() {
    super('이미 연결된 계정 또는 제공자입니다.');
    this.name = 'SocialAccountConflictError';
  }
}
