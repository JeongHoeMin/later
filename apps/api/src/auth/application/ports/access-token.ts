export type IssuedAccessToken = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

export type AuthenticatedUser = { userId: string };

export const ACCESS_TOKEN_ISSUER = Symbol('AccessTokenIssuer');
export const ACCESS_TOKEN_VERIFIER = Symbol('AccessTokenVerifier');

export interface AccessTokenIssuer {
  issue(userId: string): Promise<IssuedAccessToken>;
}

export interface AccessTokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}
