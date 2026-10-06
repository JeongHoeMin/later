import * as SecureStore from 'expo-secure-store';
import { ApiError, apiRequest } from '../../../../shared/api/apiClient';
import { logout } from '../logout';
import { saveSessionTokens } from '../tokenStorage';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});
jest.mock('../../../../shared/api/apiClient', () => ({
  ...jest.requireActual('../../../../shared/api/apiClient'),
  apiRequest: jest.fn(),
}));

const api = jest.mocked(apiRequest);

beforeEach(() => jest.clearAllMocks());

it('서비스 토큰을 보안 저장소에 저장한다', async () => {
  await saveSessionTokens({ accessToken: 'a', refreshToken: 'r' });

  expect(await SecureStore.getItemAsync('later.accessToken')).toBe('a');
  expect(await SecureStore.getItemAsync('later.refreshToken')).toBe('r');
});

it('로그아웃은 저장된 Refresh Token으로 서버 세션을 폐기하고 로컬 토큰을 지운다', async () => {
  await saveSessionTokens({ accessToken: 'a', refreshToken: 'r' });
  api.mockResolvedValue(undefined);

  await logout();

  expect(api).toHaveBeenCalledWith('POST', '/auth/logout', {
    body: { refreshToken: 'r' },
  });
  expect(await SecureStore.getItemAsync('later.accessToken')).toBeNull();
  expect(await SecureStore.getItemAsync('later.refreshToken')).toBeNull();
});

it('서버 로그아웃이 실패해도 로컬 토큰은 지운다', async () => {
  await saveSessionTokens({ accessToken: 'a', refreshToken: 'r' });
  api.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR'));

  await expect(logout()).resolves.toBeUndefined();

  expect(await SecureStore.getItemAsync('later.refreshToken')).toBeNull();
});

it('저장된 Refresh Token이 없으면 서버를 호출하지 않는다', async () => {
  await logout();

  expect(api).not.toHaveBeenCalled();
});
