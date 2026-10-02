export class InvalidAccessTokenError extends Error {
  constructor() {
    super('유효하지 않은 Access Token입니다.');
    this.name = 'InvalidAccessTokenError';
  }
}
