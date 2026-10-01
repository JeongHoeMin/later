import { Module } from '@nestjs/common';
import { PrismaClient } from '@db/client.js';
import { PrismaModule } from '../database/prisma.module.js';
import { FindOrCreateSocialUserUseCase } from '@users/application/find-or-create-social-user.use-case.js';
import {
  SOCIAL_USER_REPOSITORY,
  type SocialUserRepository,
} from '@users/application/ports/social-user.repository.js';
import { PrismaSocialUserRepository } from '@users/infrastructure/persistence/prisma-social-user.repository.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: SOCIAL_USER_REPOSITORY,
      inject: [PrismaClient],
      useFactory: (client: PrismaClient): SocialUserRepository =>
        new PrismaSocialUserRepository(client),
    },
    {
      provide: FindOrCreateSocialUserUseCase,
      inject: [SOCIAL_USER_REPOSITORY],
      useFactory: (repository: SocialUserRepository) =>
        new FindOrCreateSocialUserUseCase(repository),
    },
  ],
  exports: [FindOrCreateSocialUserUseCase],
})
export class UsersModule {}
