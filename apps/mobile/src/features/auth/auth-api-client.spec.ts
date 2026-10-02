import { describe, expect, it, vi } from 'vitest';
import { AuthApiClient, type SocialLoginInput } from './auth-api-client.js';

const tokens = {
  accessToken: 'service-access',
  refreshToken: 'service-refresh',
  tokenType: 'Bearer',
  expiresIn: 900,
};

describe('AuthApiClient', () => {
  it.each([200, 503])(
    'reports a timeout while receiving a %s response body',
    async (status) => {
      vi.useFakeTimers();
      try {
        const request = vi.fn<typeof fetch>().mockImplementation(
          async (_url, options) =>
            ({
              status,
              ok: status === 200,
              json: () =>
                new Promise((_resolve, reject) => {
                  options?.signal?.addEventListener('abort', () =>
                    reject(new Error('aborted')),
                  );
                }),
            }) as Response,
        );
        const result = new AuthApiClient('https://api.example.test', request)
          .refresh('refresh')
          .catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(15000);
        expect(await result).toMatchObject({ kind: 'timeout' });
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it('aborts a stalled request after 15 seconds without retrying', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn<typeof fetch>().mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () =>
              reject(new Error('aborted')),
            );
          }),
      );
      const result = new AuthApiClient('https://api.example.test', request)
        .startApple()
        .catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(15000);
      expect(await result).toMatchObject({ kind: 'timeout' });
      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([400, 401, 503])(
    'preserves HTTP status %s for non-JSON errors',
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('upstream detail', { status }));
      await expect(
        new AuthApiClient('https://api.example.test', request).refresh(
          'refresh',
        ),
      ).rejects.toMatchObject({ kind: 'http', status });
    },
  );

  it('rejects non-JSON and unexpected success status responses', async () => {
    for (const response of [
      new Response('not json'),
      Response.json(tokens, { status: 201 }),
    ]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(
        new AuthApiClient('https://api.example.test', request).refresh(
          'refresh',
        ),
      ).rejects.toMatchObject({ kind: 'invalid-response' });
    }
  });
  it.each<SocialLoginInput>([
    { provider: 'google', credential: 'google-id-token' },
    { provider: 'kakao', credential: 'kakao-access-token' },
    { provider: 'naver', credential: 'naver-code', state: 'client-state' },
    {
      provider: 'apple',
      credential: 'apple-id-token',
      loginAttemptId: 'attempt',
    },
  ])(
    'exchanges $provider credentials without a service Authorization header',
    async (input) => {
      const result = { ...tokens, user: { id: 'user-id' } };
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(result));
      const client = new AuthApiClient('https://api.example.test/', request);
      await expect(client.login(input)).resolves.toEqual(result);
      expect(request).toHaveBeenCalledWith(
        'https://api.example.test/auth/social/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
      );
    },
  );

  it('starts Apple verification and preserves the server nonce', async () => {
    const attempt = {
      loginAttemptId: 'attempt',
      nonce: 'server-nonce',
      expiresIn: 300,
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(attempt, { status: 201 }));
    await expect(
      new AuthApiClient('https://api.example.test', request).startApple(),
    ).resolves.toEqual(attempt);
    expect(request).toHaveBeenCalledWith(
      'https://api.example.test/auth/social/apple/start',
      expect.objectContaining({ body: '{}' }),
    );
  });

  it('refreshes rotated service tokens', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(tokens));
    await expect(
      new AuthApiClient('https://api.example.test', request).refresh(
        'old-refresh',
      ),
    ).resolves.toEqual(tokens);
    expect(request).toHaveBeenCalledWith(
      'https://api.example.test/auth/token/refresh',
      expect.objectContaining({ body: '{"refreshToken":"old-refresh"}' }),
    );
  });

  it('accepts an empty logout 204 without parsing JSON', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      new AuthApiClient('https://api.example.test', request).logout('refresh'),
    ).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(
      'https://api.example.test/auth/logout',
      expect.objectContaining({ body: '{"refreshToken":"refresh"}' }),
    );
  });

  it('maps HTTP errors without exposing server messages or credentials and never retries', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'sensitive-value',
          },
        },
        { status: 401 },
      ),
    );
    const error = await new AuthApiClient('https://api.example.test', request)
      .refresh('secret')
      .catch((value: unknown) => value);
    expect(error).toMatchObject({
      kind: 'http',
      status: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
    expect(String(error)).not.toContain('sensitive-value');
    expect(String(error)).not.toContain('secret');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed successful responses', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ...tokens, refreshToken: '' }));
    await expect(
      new AuthApiClient('https://api.example.test', request).refresh('refresh'),
    ).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('maps transport failures without leaking their message', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('private-network-detail'));
    await expect(
      new AuthApiClient('https://api.example.test', request).startApple(),
    ).rejects.toMatchObject({
      kind: 'network',
      message: '인증 서버에 연결할 수 없습니다.',
    });
  });

  it.each([
    '',
    'ftp://api.example.test',
    'https://user:password@api.example.test',
    'https://api.example.test?token=secret',
  ])('rejects invalid base URL %s', (url) => {
    expect(() => new AuthApiClient(url)).toThrow(
      '인증 API 주소 설정을 확인해주세요.',
    );
  });
});
