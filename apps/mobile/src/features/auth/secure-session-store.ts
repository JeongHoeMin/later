import * as SecureStore from 'expo-secure-store';
import type { SessionStore, StoredSession } from './auth-session.js';

export class SecureSessionStore implements SessionStore {
  private readonly key = 'later.auth.session.v1';

  async read(): Promise<StoredSession | null> {
    try {
      const text = await SecureStore.getItemAsync(this.key);
      if (!text) return null;
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        value = null;
      }
      if (
        typeof value === 'object' &&
        value !== null &&
        'userId' in value &&
        typeof value.userId === 'string' &&
        value.userId.trim() &&
        'refreshToken' in value &&
        typeof value.refreshToken === 'string' &&
        value.refreshToken.trim() &&
        'provider' in value &&
        ['google', 'kakao', 'naver', 'apple'].includes(String(value.provider))
      ) {
        return {
          userId: value.userId,
          refreshToken: value.refreshToken,
          provider: value.provider as StoredSession['provider'],
        };
      }
      await this.clear();
      return null;
    } catch {
      throw new Error('인증 저장소를 사용할 수 없습니다.');
    }
  }

  async write(session: StoredSession): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        this.key,
        JSON.stringify({
          userId: session.userId,
          provider: session.provider,
          refreshToken: session.refreshToken,
        }),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
      );
    } catch {
      throw new Error('인증 저장소를 사용할 수 없습니다.');
    }
  }

  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.key);
    } catch {
      throw new Error('인증 저장소를 사용할 수 없습니다.');
    }
  }
}
