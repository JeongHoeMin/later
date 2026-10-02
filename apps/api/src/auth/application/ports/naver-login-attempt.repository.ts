export const NAVER_LOGIN_ATTEMPTS = Symbol('NaverLoginAttempts');
export interface NaverLoginAttempt {
  id: string;
  stateHash: string;
  secretHash: string;
  expiresAt: Date;
}
export interface NaverLoginAttemptRepository {
  create(attempt: NaverLoginAttempt): Promise<void>;
  acceptCallback(
    stateHash: string,
    sealedGrant: string,
    now: Date,
  ): Promise<string | null>;
  consume(id: string, secretHash: string, now: Date): Promise<string | null>;
}
export interface NaverLoginSecurity {
  generate(): { id: string; state: string; attemptSecret: string };
  hash(value: string): string;
  seal(value: { code: string; state: string } | null): string;
  open(value: string): { code: string; state: string } | null;
}
export interface NaverLoginSettings {
  clientId: string;
  callbackUrl: string;
  appReturnUrl: string;
}
