import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import { SecureSessionStore } from './secure-session-store.js';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
}));

const stored = {
  userId: 'user',
  provider: 'google' as const,
  refreshToken: 'refresh',
};
const key = 'later.auth.session.v1';

describe('SecureSessionStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it('writes only refresh/session metadata in device-only keychain storage', async () => {
    await new SecureSessionStore().write(stored);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      key,
      JSON.stringify(stored),
      { keychainAccessible: 6 },
    );
  });
  it('reads a validated record', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify(stored),
    );
    await expect(new SecureSessionStore().read()).resolves.toEqual(stored);
  });
  it.each([
    'bad-json',
    JSON.stringify({ ...stored, provider: 'unknown' }),
    JSON.stringify({ ...stored, refreshToken: '' }),
  ])('deletes invalid stored data: %s', async (value) => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(value);
    await expect(new SecureSessionStore().read()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
  });
  it('deletes the saved session', async () => {
    await new SecureSessionStore().clear();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
  });
  it('masks native storage failures', async () => {
    vi.mocked(SecureStore.getItemAsync).mockRejectedValue(
      new Error('native-secret'),
    );
    await expect(new SecureSessionStore().read()).rejects.toThrow(
      '인증 저장소를 사용할 수 없습니다.',
    );
  });
});
