import { Module } from '@nestjs/common';
import { PrismaClient } from '@db/client.js';
import { PrismaModule } from '../database/prisma.module.js';
import {
  USER_ACCOUNT_REPOSITORY,
  type UserAccountRepository,
} from './application/ports/user-account.repository.js';
import { PrismaUserAccountRepository } from './infrastructure/persistence/prisma-user-account.repository.js';
import { WithdrawUserUseCase } from './application/withdraw-user.use-case.js';
import { ListSocialAccountsUseCase } from './application/list-social-accounts.use-case.js';
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: USER_ACCOUNT_REPOSITORY,
      inject: [PrismaClient],
      useFactory: (prisma: PrismaClient) =>
        new PrismaUserAccountRepository(prisma),
    },
    {
      provide: WithdrawUserUseCase,
      inject: [USER_ACCOUNT_REPOSITORY],
      useFactory: (users: UserAccountRepository) =>
        new WithdrawUserUseCase(users),
    },
    {
      provide: ListSocialAccountsUseCase,
      inject: [USER_ACCOUNT_REPOSITORY],
      useFactory: (users: UserAccountRepository) =>
        new ListSocialAccountsUseCase(users),
    },
  ],
  exports: [
    USER_ACCOUNT_REPOSITORY,
    WithdrawUserUseCase,
    ListSocialAccountsUseCase,
  ],
})
export class UserAccountModule {}
