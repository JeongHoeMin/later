export const APPLE_LOGIN_ATTEMPT_REPOSITORY = Symbol(
  'AppleLoginAttemptRepository',
);

export interface AppleLoginAttemptRepository {
  create(attempt: {
    id: string;
    nonceHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consume(id: string, nonceHash: string, now: Date): Promise<boolean>;
}

export interface AppleLoginAttemptGenerator {
  generate(): { id: string; nonce: string; nonceHash: string };
}
