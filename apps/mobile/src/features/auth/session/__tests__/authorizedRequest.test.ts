import { ApiError, apiRequest } from '../../../../shared/api/apiClient';
import {
  authorizedRequest,
  onSessionExpired,
  SessionExpiredError,
} from '../authorizedRequest';
import { restoreSession } from '../restoreSession';
import { clearSessionTokens, saveSessionTokens } from '../tokenStorage';
import { withdraw } from '../withdraw';
import { secureStoreMock } from '../__testing__/secureStoreMock';

jest.mock(
  'expo-secure-store',
  () => jest.requireActual('../__testing__/secureStoreMock').secureStoreMock,
);
jest.mock('../../../../shared/api/apiClient', () => ({
  ...jest.requireActual('../../../../shared/api/apiClient'),
  apiRequest: jest.fn(),
}));

type Options = { body?: unknown; headers?: Record<string, string> };

const api = jest.mocked(apiRequest);
const stored = (key: string) => secureStoreMock.store.get(key) ?? null;
const unauthorized = () => new ApiError(401, 'INVALID_ACCESS_TOKEN');
const newTokens = {
  accessToken: 'a2',
  refreshToken: 'r2',
  tokenType: 'Bearer',
  expiresIn: 900,
};

function routes(handlers: Record<string, (options: Options) => unknown>) {
  api.mockImplementation(async (method, path, options) => {
    const handler = handlers[`${method} ${path}`];
    if (!handler) throw new Error(`unexpected ${method} ${path}`);
    return handler((options ?? {}) as Options);
  });
}

const calls = (method: string, path: string) =>
  api.mock.calls.filter(([m, p]) => m === method && p === path);

const rejectOldToken =
  (value: unknown) =>
  ({ headers }: Options) => {
    if (headers?.Authorization === 'Bearer a1') throw unauthorized();
    return value;
  };

beforeEach(async () => {
  jest.clearAllMocks();
  await clearSessionTokens();
  await saveSessionTokens({ accessToken: 'a1', refreshToken: 'r1' });
});

describe('authorizedRequest', () => {
  it('저장된 Access Token을 Bearer 헤더로 보낸다', async () => {
    routes({ 'GET /auth/me': () => ({ user: { id: 'u1' } }) });

    await expect(authorizedRequest('GET', '/auth/me')).resolves.toEqual({
      user: { id: 'u1' },
    });
    expect(api).toHaveBeenCalledWith('GET', '/auth/me', {
      headers: { Authorization: 'Bearer a1' },
    });
  });

  it('401이면 Refresh Token으로 한 번 갱신해 저장하고 원 요청을 재시도한다', async () => {
    routes({
      'GET /auth/me': rejectOldToken({ user: { id: 'u1' } }),
      'POST /auth/token/refresh': () => newTokens,
    });

    await expect(authorizedRequest('GET', '/auth/me')).resolves.toEqual({
      user: { id: 'u1' },
    });
    expect(api).toHaveBeenCalledWith('POST', '/auth/token/refresh', {
      body: { refreshToken: 'r1' },
    });
    expect(calls('GET', '/auth/me')).toHaveLength(2);
    expect(stored('later.accessToken')).toBe('a2');
    expect(stored('later.refreshToken')).toBe('r2');
  });

  it('동시에 401을 받은 요청들은 갱신을 한 번만 요청한다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    routes({
      'GET /a': rejectOldToken('A'),
      'GET /b': rejectOldToken('B'),
      'POST /auth/token/refresh': async () => {
        await gate;
        return newTokens;
      },
    });

    const both = Promise.all([
      authorizedRequest('GET', '/a'),
      authorizedRequest('GET', '/b'),
    ]);
    await new Promise((r) => setTimeout(r, 0));
    release();

    await expect(both).resolves.toEqual(['A', 'B']);
    expect(calls('POST', '/auth/token/refresh')).toHaveLength(1);
  });

  it('갱신이 401이면 토큰을 지우고 세션 만료를 알린다', async () => {
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);
    routes({
      'GET /auth/me': rejectOldToken(null),
      'POST /auth/token/refresh': () => {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN');
      },
    });

    await expect(authorizedRequest('GET', '/auth/me')).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    expect(stored('later.accessToken')).toBeNull();
    expect(stored('later.refreshToken')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('갱신 후에도 401이면 다시 갱신하지 않고 세션을 만료한다', async () => {
    routes({
      'GET /auth/me': () => {
        throw unauthorized();
      },
      'POST /auth/token/refresh': () => newTokens,
    });

    await expect(authorizedRequest('GET', '/auth/me')).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    expect(calls('POST', '/auth/token/refresh')).toHaveLength(1);
    expect(stored('later.refreshToken')).toBeNull();
  });

  it('갱신이 네트워크 오류면 토큰을 유지하고 오류를 전달한다', async () => {
    routes({
      'GET /auth/me': rejectOldToken(null),
      'POST /auth/token/refresh': () => {
        throw new ApiError(0, 'NETWORK_ERROR');
      },
    });

    await expect(authorizedRequest('GET', '/auth/me')).rejects.toMatchObject({
      status: 0,
    });
    expect(stored('later.refreshToken')).toBe('r1');
  });

  it('401이 아닌 오류는 갱신 없이 전달한다', async () => {
    routes({
      'GET /x': () => {
        throw new ApiError(503, 'INTERNAL_SERVER_ERROR');
      },
    });

    await expect(authorizedRequest('GET', '/x')).rejects.toMatchObject({
      status: 503,
    });
    expect(calls('POST', '/auth/token/refresh')).toHaveLength(0);
  });
});

describe('restoreSession', () => {
  it('저장된 Refresh Token이 없으면 서버를 호출하지 않고 로그아웃 상태다', async () => {
    await clearSessionTokens();
    routes({});

    await expect(restoreSession()).resolves.toEqual({ type: 'signedOut' });
    expect(api).not.toHaveBeenCalled();
  });

  it('/auth/me로 회원 ID를 확인해 로그인 상태로 복원한다', async () => {
    routes({ 'GET /auth/me': () => ({ user: { id: 'u1' } }) });

    await expect(restoreSession()).resolves.toEqual({
      type: 'signedIn',
      session: { userId: 'u1' },
    });
  });

  it('갱신이 거부되면 토큰을 지우고 로그아웃 상태다', async () => {
    routes({
      'GET /auth/me': rejectOldToken(null),
      'POST /auth/token/refresh': () => {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN');
      },
    });

    await expect(restoreSession()).resolves.toEqual({ type: 'signedOut' });
    expect(stored('later.refreshToken')).toBeNull();
  });

  it('네트워크·서버 오류는 토큰을 유지하고 오류를 던진다', async () => {
    routes({
      'GET /auth/me': () => {
        throw new ApiError(0, 'NETWORK_ERROR');
      },
    });

    await expect(restoreSession()).rejects.toMatchObject({ status: 0 });
    expect(stored('later.refreshToken')).toBe('r1');
  });
});

describe('withdraw', () => {
  it('DELETE /users/me 성공 후 로컬 토큰을 지운다', async () => {
    routes({ 'DELETE /users/me': () => undefined });

    await withdraw();

    expect(api).toHaveBeenCalledWith('DELETE', '/users/me', {
      headers: { Authorization: 'Bearer a1' },
    });
    expect(stored('later.accessToken')).toBeNull();
    expect(stored('later.refreshToken')).toBeNull();
  });

  it('이미 탈퇴·만료(갱신 401)여도 로컬 토큰을 지우고 완료한다', async () => {
    routes({
      'DELETE /users/me': rejectOldToken(undefined),
      'POST /auth/token/refresh': () => {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN');
      },
    });

    await expect(withdraw()).resolves.toBeUndefined();
    expect(stored('later.refreshToken')).toBeNull();
  });

  it('네트워크·서버 오류면 토큰을 유지하고 오류를 던진다', async () => {
    routes({
      'DELETE /users/me': () => {
        throw new ApiError(500, 'INTERNAL_SERVER_ERROR');
      },
    });

    await expect(withdraw()).rejects.toMatchObject({ status: 500 });
    expect(stored('later.refreshToken')).toBe('r1');
  });
});
