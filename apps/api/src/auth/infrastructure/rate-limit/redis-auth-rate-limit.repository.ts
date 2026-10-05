import { createClient } from '@redis/client';
import {
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import type {
  AuthRateLimitRepository,
  RateLimitResult,
} from '../../application/ports/auth-rate-limit.repository.js';

export const AUTH_RATE_LIMIT_PREFIX = 'later:auth:rate-limit:v1:';
const consumeScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local count = tonumber(redis.call('GET', key))
local ttl = redis.call('PTTL', key)
if ttl == -2 then
  redis.call('SET', key, 1, 'PX', 60000)
  return {1, 60000}
end
if not count or ttl < 0 then return {-1, 0} end
if count >= limit then return {0, ttl} end
redis.call('INCR', key)
return {1, ttl}
`;

export function readRedisUrl(value?: string): string {
  try {
    const url = new URL(value ?? '');
    if (
      !['redis:', 'rediss:'].includes(url.protocol) ||
      !url.hostname ||
      (url.pathname !== '' &&
        url.pathname !== '/' &&
        !/^\/\d+$/.test(url.pathname)) ||
      url.hash ||
      url.search
    )
      throw new Error();
    return value!;
  } catch {
    throw new Error('유효한 REDIS_URL 설정이 필요합니다.');
  }
}

export class RedisAuthRateLimitRepository
  implements AuthRateLimitRepository, OnModuleInit, OnModuleDestroy
{
  private readonly client: ReturnType<typeof createClient>;
  private readonly logger = new Logger(RedisAuthRateLimitRepository.name);
  private startup?: Promise<void>;
  private stopped = false;

  constructor(url: string) {
    this.client = createClient({
      url: readRedisUrl(url),
      disableOfflineQueue: true,
      commandsQueueMaxLength: 1000,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) =>
          Math.min(100 * 2 ** Math.min(retries, 5), 2000),
      },
    });
    let reported = false;
    this.client.on('error', () => {
      if (!reported)
        this.logger.error({ event: 'auth.rate-limit.redis-unavailable' });
      reported = true;
    });
    this.client.on('ready', () => {
      reported = false;
    });
  }

  async onModuleInit(): Promise<void> {
    this.startup ??= this.connect();
    await this.startup;
  }

  private async connect(): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.client.connect(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error()), 5000);
        }),
      ]);
    } catch {
      if (this.client.isOpen) this.client.destroy();
      throw new Error('요청 제한 Redis에 연결할 수 없습니다.');
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.client.isOpen) this.client.destroy();
  }

  private reconnect(): void {
    if (this.stopped || this.client.isOpen) return;
    this.startup = this.connect();
    void this.startup.catch(() => {});
  }

  async consume(key: string, limit: number): Promise<RateLimitResult> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!this.client.isReady) {
        this.reconnect();
        throw new Error();
      }
      const command = this.client
        .withAbortSignal(AbortSignal.timeout(1000))
        .eval(consumeScript, {
          keys: [AUTH_RATE_LIMIT_PREFIX + key],
          arguments: [String(limit)],
        });
      const result = await Promise.race([
        command,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            // AbortSignal only cancels queued node-redis commands. Close a stalled ready connection to bound in-flight work, then reconnect.
            if (this.client.isReady) this.client.destroy();
            this.reconnect();
            reject(new Error());
          }, 1000);
        }),
      ]);
      if (
        !Array.isArray(result) ||
        result.length !== 2 ||
        (result[0] !== 0 && result[0] !== 1) ||
        typeof result[1] !== 'number' ||
        result[1] < 0
      )
        throw new Error();
      return {
        allowed: result[0] === 1,
        retryAfter: Math.max(1, Math.ceil(result[1] / 1000)),
      };
    } catch {
      throw new Error('요청 제한 저장소를 사용할 수 없습니다.');
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
