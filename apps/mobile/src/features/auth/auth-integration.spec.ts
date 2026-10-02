import { describe, expect, it, vi } from 'vitest';
import { AuthApiClient, type SocialLoginInput } from './auth-api-client.js';
import { AuthSession, type StoredSession } from './auth-session.js';

describe('mobile auth HTTP/session integration', () => {
  it.each<SocialLoginInput>([
    { provider: 'google', credential: 'google-id-token' },
    { provider: 'kakao', credential: 'kakao-access-token' },
    { provider: 'naver', credential: 'naver-code', state: 'validated-state' },
    {
      provider: 'apple',
      credential: 'apple-id-token',
      loginAttemptId: '8b674e82-a48d-4b31-81a2-9b9ea4ba951d',
    },
  ])(
    'connects $provider login, persisted restore and logout through the real client',
    async (input) => {
      let saved: StoredSession | null = null;
      const requests: { path: string; body: unknown }[] = [];
      const request = vi
        .fn<typeof fetch>()
        .mockImplementation(async (url, options) => {
          const path = new URL(String(url)).pathname;
          const body: unknown = JSON.parse(String(options?.body));
          requests.push({ path, body });
          expect(options?.headers).toEqual({
            'Content-Type': 'application/json',
          });
          if (path.endsWith('/apple/start'))
            return Response.json(
              {
                loginAttemptId: '8b674e82-a48d-4b31-81a2-9b9ea4ba951d',
                nonce: 'server-nonce',
                expiresIn: 300,
              },
              { status: 201 },
            );
          if (path.endsWith('/social/login'))
            return Response.json({
              user: { id: '2f3a7e1d-8017-48a7-8fbe-e4115f9c922f' },
              accessToken: 'access',
              refreshToken: 'refresh',
              tokenType: 'Bearer',
              expiresIn: 900,
            });
          if (path.endsWith('/token/refresh'))
            return Response.json({
              accessToken: 'rotated-access',
              refreshToken: 'rotated-refresh',
              tokenType: 'Bearer',
              expiresIn: 900,
            });
          if (path.endsWith('/logout'))
            return new Response(null, { status: 204 });
          throw new Error('Unexpected HTTP path');
        });
      const store = {
        read: async () => saved,
        write: async (record: StoredSession) => {
          saved = record;
        },
        clear: async () => {
          saved = null;
        },
      };
      const api = new AuthApiClient('https://api.example.test', request);
      if (input.provider === 'apple') {
        const attempt = await api.startApple();
        expect(attempt.nonce).toBe('server-nonce');
        expect(attempt.loginAttemptId).toBe(input.loginAttemptId);
      }
      const firstLaunch = new AuthSession(api, store);
      await firstLaunch.login(input);
      expect(requests).toContainEqual({
        path: '/auth/social/login',
        body: input,
      });
      expect(saved).not.toHaveProperty('accessToken');
      const nextLaunch = new AuthSession(api, store);
      expect(nextLaunch.current).toBeNull();
      await nextLaunch.restore();
      await expect(nextLaunch.getAccessToken()).resolves.toBe('rotated-access');
      await nextLaunch.logout();
      expect(requests).toContainEqual({
        path: '/auth/logout',
        body: { refreshToken: 'rotated-refresh' },
      });
      expect(saved).toBeNull();
      expect(nextLaunch.current).toBeNull();
    },
  );
});
