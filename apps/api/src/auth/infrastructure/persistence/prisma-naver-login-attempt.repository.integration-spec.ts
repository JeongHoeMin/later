import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID, createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@db/client.js';
import { PrismaNaverLoginAttemptRepository } from './prisma-naver-login-attempt.repository.js';

describe('PrismaNaverLoginAttemptRepository', () => {
  const now = new Date('2026-10-02T00:00:00Z');
  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  const ids: string[] = [];
  let client: PrismaClient;
  let repository: PrismaNaverLoginAttemptRepository;
  beforeAll(async () => {
    const url = config({ path: '.env.test', quiet: true }).parsed?.DATABASE_URL;
    if (!url || new URL(url).pathname !== '/later_test')
      throw new Error('later_test required');
    client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    await client.$connect();
    repository = new PrismaNaverLoginAttemptRepository(client);
  });
  afterAll(async () => {
    try {
      if (ids.length)
        await client.naverLoginAttempt.deleteMany({
          where: { id: { in: ids } },
        });
    } finally {
      await client?.$disconnect();
    }
  });
  async function create(expiresAt = new Date(now.getTime() + 300000)) {
    const id = randomUUID();
    ids.push(id);
    const stateHash = hash(id + ':state');
    const secretHash = hash(id + ':proof');
    await repository.create({ id, stateHash, secretHash, expiresAt });
    return { id, stateHash, secretHash };
  }
  it('stores hashes and consumes a callback and grant once, deleting sealed credentials after use', async () => {
    const attempt = await create();
    expect(
      await repository.consume(attempt.id, attempt.secretHash, now),
    ).toBeNull();
    expect(
      await repository.acceptCallback(
        attempt.stateHash,
        'encrypted-grant',
        now,
      ),
    ).toBe(attempt.id);
    expect(
      await repository.acceptCallback(attempt.stateHash, 'replacement', now),
    ).toBeNull();
    expect(await repository.consume(attempt.id, attempt.secretHash, now)).toBe(
      'encrypted-grant',
    );
    expect(
      await repository.consume(attempt.id, attempt.secretHash, now),
    ).toBeNull();
    expect(
      await client.naverLoginAttempt.findUnique({ where: { id: attempt.id } }),
    ).toMatchObject({ sealedGrant: null, callbackAt: now, usedAt: now });
  });
  it('does not consume mismatched state or proof', async () => {
    const attempt = await create();
    expect(
      await repository.acceptCallback(hash('wrong-state'), 'grant', now),
    ).toBeNull();
    expect(
      await repository.acceptCallback(attempt.stateHash, 'grant', now),
    ).toBe(attempt.id);
    expect(
      await repository.consume(attempt.id, hash('wrong-proof'), now),
    ).toBeNull();
    expect(await repository.consume(attempt.id, attempt.secretHash, now)).toBe(
      'grant',
    );
  });
  it('rejects callbacks and completion at exact expiry', async () => {
    const expired = await create(now);
    expect(
      await repository.acceptCallback(expired.stateHash, 'grant', now),
    ).toBeNull();
    const ready = await create();
    await repository.acceptCallback(ready.stateHash, 'grant', now);
    expect(
      await repository.consume(
        ready.id,
        ready.secretHash,
        new Date(now.getTime() + 300000),
      ),
    ).toBeNull();
  });
  it('permits exactly one concurrent callback and one concurrent completion', async () => {
    const attempt = await create();
    const callbacks = await Promise.all(
      Array.from({ length: 8 }, () =>
        repository.acceptCallback(attempt.stateHash, 'grant', now),
      ),
    );
    expect(callbacks.filter(Boolean)).toHaveLength(1);
    const completions = await Promise.all(
      Array.from({ length: 8 }, () =>
        repository.consume(attempt.id, attempt.secretHash, now),
      ),
    );
    expect(completions.filter(Boolean)).toEqual(['grant']);
  });
});
