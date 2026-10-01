export const REFRESH_TOKEN_GENERATOR = Symbol('RefreshTokenGenerator');
export interface RefreshTokenGenerator {
  generate(): { token: string; hash: string };
}
