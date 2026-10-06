import { ApiError, apiRequest } from '../../../shared/api/apiClient';
import { refreshTokens } from '../api/authApi';
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  saveSessionTokens,
} from './tokenStorage';

type Method = 'GET' | 'POST' | 'DELETE';

// 갱신이 거부되어 새 로그인이 필요한 상태. 로컬 토큰은 이미 지워졌다.
export class SessionExpiredError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Session expired', options);
    this.name = 'SessionExpiredError';
  }
}

const expiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

async function expireSession(cause?: unknown): Promise<never> {
  await clearSessionTokens();
  expiredListeners.forEach((listener) => listener());
  throw new SessionExpiredError({ cause });
}

const isUnauthorized = (error: unknown) =>
  error instanceof ApiError && error.status === 401;

async function refreshOnce(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return expireSession();
  try {
    const { accessToken, refreshToken: next } =
      await refreshTokens(refreshToken);
    await saveSessionTokens({ accessToken, refreshToken: next });
  } catch (error) {
    // 401(만료·폐기·재사용·탈퇴)만 새 로그인이 필요하다. 그 외 일시 오류는 토큰을 유지한다.
    if (isUnauthorized(error)) return expireSession(error);
    throw error;
  }
}

// 같은 Refresh Token을 동시에 갱신하면 서버가 재사용으로 보고 세션을 폐기하므로 한 번만 보낸다.
let inFlightRefresh: Promise<void> | null = null;

export function refreshSession(): Promise<void> {
  inFlightRefresh ??= refreshOnce().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function send<T>(
  method: Method,
  path: string,
  options: { body?: unknown },
): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) return expireSession();
  return apiRequest<T>(method, path, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Later 서비스 Bearer 요청. 401이면 한 번 갱신하고 한 번만 재시도한다. 토큰은 로그에 남기지 않는다.
export async function authorizedRequest<T>(
  method: Method,
  path: string,
  options: { body?: unknown } = {},
): Promise<T> {
  try {
    return await send<T>(method, path, options);
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
  }
  await refreshSession();
  try {
    return await send<T>(method, path, options);
  } catch (error) {
    if (isUnauthorized(error)) return expireSession(error);
    throw error;
  }
}
