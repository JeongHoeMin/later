import type {
  AppleLoginAttemptGenerator,
  AppleLoginAttemptRepository,
} from './ports/apple-login-attempt.repository.js';

export class StartAppleLoginUseCase {
  constructor(
    private readonly attempts: AppleLoginAttemptRepository,
    private readonly generator: AppleLoginAttemptGenerator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<{
    loginAttemptId: string;
    nonce: string;
    expiresIn: number;
  }> {
    const attempt = this.generator.generate();
    await this.attempts.create({
      id: attempt.id,
      nonceHash: attempt.nonceHash,
      expiresAt: new Date(this.now().getTime() + 300_000),
    });
    return { loginAttemptId: attempt.id, nonce: attempt.nonce, expiresIn: 300 };
  }
}
