import type {
  UserAccountRepository,
  LinkedSocialAccount,
} from './ports/user-account.repository.js';
export class ListSocialAccountsUseCase {
  constructor(
    private readonly users: Pick<UserAccountRepository, 'listSocialAccounts'>,
  ) {}
  async execute(userId: string): Promise<LinkedSocialAccount[]> {
    return this.users.listSocialAccounts(userId);
  }
}
