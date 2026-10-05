import type { UserAccountRepository } from './ports/user-account.repository.js';
export class WithdrawUserUseCase {
  constructor(
    private readonly users: Pick<UserAccountRepository, 'withdraw'>,
  ) {}
  async execute(userId: string): Promise<void> {
    await this.users.withdraw(userId);
  }
}
