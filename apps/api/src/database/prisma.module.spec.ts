import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@db/client.js';
import { PrismaModule } from './prisma.module.js';

describe('PrismaModule', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('DATABASE_URL이 없으면 기본 DB로 연결하지 않고 초기화에 실패한다', async () => {
    vi.stubEnv('DATABASE_URL', '');

    await expect(
      Test.createTestingModule({ imports: [PrismaModule] })
        .compile()
        .then(async (module) => {
          await module.close();
          return 'initialized';
        }),
    ).rejects.toThrow('DATABASE_URL이 필요합니다.');
  });

  it('모듈 초기화에서 DB 연결을 열고 종료에서 연결을 닫는다', async () => {
    let connected = false;
    const client = {
      $connect: async () => {
        connected = true;
      },
      $disconnect: async () => {
        connected = false;
      },
    };
    const module = await Test.createTestingModule({ imports: [PrismaModule] })
      .overrideProvider(PrismaClient)
      .useValue(client)
      .compile();

    try {
      expect(connected).toBe(false);
      await module.init();
      expect(connected).toBe(true);
    } finally {
      await module.close();
    }

    expect(connected).toBe(false);
  });
});
