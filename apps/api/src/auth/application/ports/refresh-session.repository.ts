export const REFRESH_SESSION_REPOSITORY = Symbol('RefreshSessionRepository');
export type RotationResult = 'rotated' | 'invalid' | 'reused';
export interface RefreshSessionRepository {
  findUserId(tokenHash: string): Promise<string | null>;
  rotate(
    tokenHash: string,
    nextHash: string,
    now: Date,
  ): Promise<RotationResult>;
  revokeByHash(tokenHash: string, now: Date): Promise<void>;
}
