import { Module } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@db/client.js';
import { PrismaConnection } from './prisma-connection.js';

@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
          throw new Error('DATABASE_URL이 필요합니다.');
        }

        return new PrismaClient({
          adapter: new PrismaPg({ connectionString }),
        });
      },
    },
    {
      provide: PrismaConnection,
      inject: [PrismaClient],
      useFactory: (client: PrismaClient) => new PrismaConnection(client),
    },
  ],
  exports: [PrismaClient],
})
export class PrismaModule {}
