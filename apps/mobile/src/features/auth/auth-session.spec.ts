import { describe, expect, it, vi } from 'vitest';
import { AuthApiError } from './auth-api-client.js';
import {
  AuthSession,
  type SessionStore,
  type StoredSession,
} from './auth-session.js';

const tokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  tokenType: 'Bearer' as const,
  expiresIn: 900,
};
const stored: StoredSession = {
  userId: 'user',
  provider: 'google',
  refreshToken: 'refresh',
};
function setup() {
  let persisted: StoredSession | null = null;
  let now = 0;
  const api = {
    login: vi.fn().mockResolvedValue({ ...tokens, user: { id: 'user' } }),
    refresh: vi.fn().mockResolvedValue({
      ...tokens,
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const store: SessionStore = {
    read: vi.fn(async () => persisted),
    write: vi.fn(async (value) => {
      persisted = value;
    }),
    clear: vi.fn(async () => {
      persisted = null;
    }),
  };
  const session = new AuthSession(api, store, () => now);
  return {
    api,
    store,
    session,
    persisted: () => persisted,
    advance: () => {
      now = 900000;
    },
  };
}

describe('AuthSession', () => {
  it('attempts deletion even when logout cannot read persisted credentials', async () => {
    const { session, store } = setup();
    vi.mocked(store.read).mockRejectedValue(
      new Error('인증 저장소를 사용할 수 없습니다.'),
    );
    await expect(session.logout()).rejects.toThrow(
      '인증 저장소를 사용할 수 없습니다.',
    );
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it('does not extend access lifetime while persistence is delayed', async () => {
    const { session, store, api, advance } = setup();
    vi.mocked(store.write).mockImplementationOnce(async () => {
      advance();
    });
    await session.login({ provider: 'google', credential: 'id-token' });
    await expect(session.getAccessToken()).resolves.toBe('next-access');
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });
  it('does not share a pre-logout access lookup with a later caller', async () => {
    const { session } = setup();
    await session.login({ provider: 'google', credential: 'id-token' });
    const before = session.getAccessToken();
    const logout = session.logout();
    const after = session.getAccessToken();
    await Promise.all([before, logout]);
    await expect(after).resolves.toBeNull();
  });
  it('persists only refresh/member metadata before publishing a login', async () => {
    const { session, store } = setup();
    await session.login({ provider: 'google', credential: 'id-token' });
    expect(store.write).toHaveBeenCalledWith(stored);
    expect(session.current?.userId).toBe('user');
    await expect(session.getAccessToken()).resolves.toBe('access');
  });

  it('does not authenticate an absent persisted session', async () => {
    const { session, api } = setup();
    await session.restore();
    expect(session.current).toBeNull();
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('verifies and rotates persisted credentials on restore', async () => {
    const { session, store, api, persisted } = setup();
    await store.write(stored);
    await session.restore();
    expect(api.refresh).toHaveBeenCalledWith('refresh');
    expect(persisted()?.refreshToken).toBe('next-refresh');
    await expect(session.getAccessToken()).resolves.toBe('next-access');
  });

  it('shares concurrent expiry refreshes and persists the rotation', async () => {
    const { session, api, advance, persisted } = setup();
    await session.login({ provider: 'google', credential: 'id-token' });
    advance();
    await expect(
      Promise.all([session.getAccessToken(), session.getAccessToken()]),
    ).resolves.toEqual(['next-access', 'next-access']);
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(persisted()?.refreshToken).toBe('next-refresh');
  });

  it('clears rejected sessions and preserves credentials on a temporary network failure', async () => {
    for (const kind of ['http', 'network'] as const) {
      const { session, store, api, persisted } = setup();
      await store.write(stored);
      api.refresh.mockRejectedValue(
        new AuthApiError(kind, kind === 'http' ? 401 : undefined),
      );
      await expect(session.restore()).rejects.toBeInstanceOf(AuthApiError);
      expect(session.current).toBeNull();
      expect(persisted()).toEqual(kind === 'http' ? null : stored);
    }
  });

  it('does not expose a login when persistence fails and revokes issued tokens', async () => {
    const { session, store, api } = setup();
    vi.mocked(store.write).mockRejectedValue(new Error('native-secret'));
    await expect(
      session.login({ provider: 'google', credential: 'id-token' }),
    ).rejects.toThrow('인증 정보를 저장할 수 없습니다.');
    expect(session.current).toBeNull();
    expect(api.logout).toHaveBeenCalledWith('refresh');
  });

  it('clears a rotated session if saving its new refresh token fails', async () => {
    const { session, store, api, advance, persisted } = setup();
    await session.login({ provider: 'google', credential: 'id-token' });
    advance();
    vi.mocked(store.write).mockRejectedValue(new Error('storage'));
    await expect(session.getAccessToken()).rejects.toThrow(
      '인증 정보를 저장할 수 없습니다.',
    );
    expect(persisted()).toBeNull();
    expect(session.current).toBeNull();
    expect(api.logout).toHaveBeenCalledWith('next-refresh');
  });

  it('logs out after an in-flight rotation without resurrecting the session', async () => {
    const { session, api, advance, persisted } = setup();
    await session.login({ provider: 'google', credential: 'id-token' });
    advance();
    const refreshing = session.getAccessToken();
    const loggingOut = session.logout();
    await Promise.all([refreshing, loggingOut]);
    expect(api.logout).toHaveBeenCalledWith('next-refresh');
    expect(session.current).toBeNull();
    expect(persisted()).toBeNull();
  });

  it('clears locally and reports failed server logout without retry', async () => {
    const { session, api, persisted } = setup();
    await session.login({ provider: 'google', credential: 'id-token' });
    api.logout.mockRejectedValue(new AuthApiError('network'));
    await expect(session.logout()).rejects.toMatchObject({ kind: 'network' });
    expect(session.current).toBeNull();
    expect(persisted()).toBeNull();
    expect(api.logout).toHaveBeenCalledTimes(1);
  });
});
