import { describe, it, expect } from 'vitest';
import { readRedisUrl } from './redis-auth-rate-limit.repository.js';
describe('Redis 설정', () => {
  it.each([
    undefined,
    '',
    'https://cache.test',
    'not-a-url',
    'redis://',
    'redis://localhost:6379/invalid',
  ])('잘못된 URL을 내부 값 없이 거부한다', (value) => {
    expect(() => readRedisUrl(value)).toThrow('유효한 REDIS_URL');
  });
  it.each([
    'redis://127.0.0.1:6379/0',
    'rediss://user:secret@cache.test:6380/0',
  ])('유효한 Redis 연결 설정을 허용한다', (value) =>
    expect(readRedisUrl(value)).toBe(value),
  );
});
