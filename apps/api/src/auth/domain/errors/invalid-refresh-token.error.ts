export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('유효하지 않은 Refresh Token입니다.');
    this.name = 'InvalidRefreshTokenError';
  }
}
