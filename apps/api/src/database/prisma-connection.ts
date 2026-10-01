import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PrismaClient } from '@db/client.js';

export class PrismaConnection implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly client: PrismaClient) {}

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
