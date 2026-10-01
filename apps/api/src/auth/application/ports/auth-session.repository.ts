export type NewAuthSession = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};
export const AUTH_SESSION_REPOSITORY = Symbol('AuthSessionRepository');
export interface AuthSessionRepository {
  create(session: NewAuthSession): Promise<void>;
}
