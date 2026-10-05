import { createRedisTestProxy } from '../../../../test/helpers/redis-test-proxy.js';
import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { createClient } from '@redis/client';
import { randomBytes } from 'node:crypto';
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import {
  RedisAuthRateLimitRepository,
  AUTH_RATE_LIMIT_PREFIX,
} from './redis-auth-rate-limit.repository.js';

describe('Redis 공유 인증 요청 제한', () => {
  let url: string;
  let client: ReturnType<typeof createClient>;
  let repository: RedisAuthRateLimitRepository;
  let replica: RedisAuthRateLimitRepository;
  const keys: string[] = [];
  const key = () => {
    const value = randomBytes(32).toString('hex');
    keys.push(value);
    return value;
  };
  beforeAll(async () => {
    const value = config({ path: '.env.test', quiet: true, override: true })
      .parsed?.REDIS_URL;
    if (
      !value ||
      !['127.0.0.1', 'localhost'].includes(new URL(value).hostname) ||
      new URL(value).pathname !== '/15'
    )
      throw new Error(
        'Redis integration은 localhost 전용 테스트 DB15에서 실행합니다.',
      );
    url = value;
    client = createClient({ url });
    client.on('error', () => {});
    await client.connect();
    repository = new RedisAuthRateLimitRepository(url);
    replica = new RedisAuthRateLimitRepository(url);
    await repository.onModuleInit();
    await replica.onModuleInit();
  });
  afterEach(async () => {
    for (const id of keys) await client.del(AUTH_RATE_LIMIT_PREFIX + id);
    keys.length = 0;
  });
  afterAll(async () => {
    await repository?.onModuleDestroy();
    await replica?.onModuleDestroy();
    if (client?.isOpen) client.destroy();
  });
  it('두 서버의 동시40요청에서 정확히20회 허용하며60초 TTL을 설정한다', async () => {
    const id = key();
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        (i % 2 ? repository : replica).consume(id, 20),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(20);
    expect(results.filter((r) => !r.allowed)).toHaveLength(20);
    const ttl = await client.pTTL(AUTH_RATE_LIMIT_PREFIX + id);
    expect(ttl).toBeGreaterThan(58000);
    expect(ttl).toBeLessThanOrEqual(60000);
  });
  it('차단된 키는 계속 증가하거나 TTL을 연장하지 않는다', async () => {
    const id = key();
    await repository.consume(id, 1);
    const ttl = await client.pTTL(AUTH_RATE_LIMIT_PREFIX + id);
    for (let i = 0; i < 10; i++)
      expect((await replica.consume(id, 1)).allowed).toBe(false);
    expect(await client.get(AUTH_RATE_LIMIT_PREFIX + id)).toBe('1');
    expect(await client.pTTL(AUTH_RATE_LIMIT_PREFIX + id)).toBeLessThanOrEqual(
      ttl,
    );
  });
  it('TTL 만료로 자동 삭제되면 새 창을 시작하고 다른 키는 독립적이다', async () => {
    const a = key(),
      b = key();
    await repository.consume(a, 1);
    expect((await repository.consume(a, 1)).allowed).toBe(false);
    expect((await repository.consume(b, 1)).allowed).toBe(true);
    await client.pExpire(AUTH_RATE_LIMIT_PREFIX + a, 50);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await client.exists(AUTH_RATE_LIMIT_PREFIX + a)).toBe(0);
    expect((await replica.consume(a, 1)).allowed).toBe(true);
    expect((await replica.consume(b, 1)).allowed).toBe(false);
  });
  it('응답 Retry-After는 TTL을 초로 올림하며 프로세스 시각을 사용하지 않는다', async () => {
    const id = key();
    await repository.consume(id, 1);
    await client.pExpire(AUTH_RATE_LIMIT_PREFIX + id, 1500);
    const result = await replica.consume(id, 1);
    expect(result).toEqual({ allowed: false, retryAfter: 2 });
  });
  it('종료한 저장소는 요청을 허용하지 않고 Redis 오류를 원문 없이 거부한다', async () => {
    const closed = new RedisAuthRateLimitRepository(url);
    await closed.onModuleInit();
    await closed.onModuleDestroy();
    await expect(closed.consume(key(), 1)).rejects.toThrow(
      '요청 제한 저장소를 사용할 수 없습니다.',
    );
  });

  async function proxyRepository() {
    const source = new URL(url);
    const proxy = await createRedisTestProxy(Number(source.port || 6379));
    source.port = String(proxy.port);
    const value = new RedisAuthRateLimitRepository(source.toString());
    return { proxy, value };
  }
  it('해당 연결만 지연시켜1초 deadline과 이후 복구를 검증한다', async () => {
    const { proxy, value } = await proxyRepository();
    try {
      await value.onModuleInit();
      proxy.setDelay(1500);
      const started = Date.now();
      await expect(value.consume(key(), 1)).rejects.toThrow(
        '요청 제한 저장소를 사용할 수 없습니다.',
      );
      expect(Date.now() - started).toBeLessThan(1600);
      proxy.setDelay(0);
      await value.onModuleInit();
      expect((await value.consume(key(), 1)).allowed).toBe(true);
    } finally {
      value.onModuleDestroy();
      await proxy.close();
    }
  });
  it('응답 대기열을1000개로 제한해 과도한 동시 요청의 메모리 누적을 막는다', async () => {
    const { proxy, value } = await proxyRepository();
    try {
      await value.onModuleInit();
      proxy.setDelay(2000);
      let failures = 0;
      const requests = Array.from({ length: 1500 }, () =>
        value.consume(key(), 1).then(
          () => true,
          () => {
            failures++;
            return false;
          },
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(failures).toBeGreaterThanOrEqual(500);
      expect((await Promise.all(requests)).some(Boolean)).toBe(false);
      proxy.setDelay(0);
      await value.onModuleInit();
    } finally {
      value.onModuleDestroy();
      await proxy.close();
    }
  });
  it('연결 손실 중 요청을 offline queue에 쌓지 않고 재연결 뒤 정상 처리한다', async () => {
    const { proxy, value } = await proxyRepository();
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    try {
      await value.onModuleInit();
      proxy.setDelay(1500);
      proxy.dropConnections();
      await new Promise((resolve) => setTimeout(resolve, 30));
      const started = Date.now();
      await expect(value.consume(key(), 1)).rejects.toThrow(
        '요청 제한 저장소를 사용할 수 없습니다.',
      );
      expect(Date.now() - started).toBeLessThan(200);
      proxy.setDelay(0);
      const deadline = Date.now() + 5000;
      let recovered = false;
      while (Date.now() < deadline && !recovered) {
        try {
          recovered = (await value.consume(key(), 1)).allowed;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      }
      expect(recovered).toBe(true);
      expect(JSON.stringify(log.mock.calls)).not.toContain(url);
    } finally {
      log.mockRestore();
      value.onModuleDestroy();
      await proxy.close();
    }
  });
  it('초기 Redis handshake가 멈춰도5초 내에 시작을 실패하고 종료한다', async () => {
    const { proxy, value } = await proxyRepository();
    try {
      proxy.setDelay(10000);
      const started = Date.now();
      await expect(value.onModuleInit()).rejects.toThrow(
        '요청 제한 Redis에 연결할 수 없습니다.',
      );
      expect(Date.now() - started).toBeLessThan(5600);
      await expect(value.consume(key(), 1)).rejects.toThrow();
    } finally {
      value.onModuleDestroy();
      await proxy.close();
    }
  });
});
