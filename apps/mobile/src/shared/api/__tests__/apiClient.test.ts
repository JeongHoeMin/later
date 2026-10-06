import { ApiError, apiRequest } from '../apiClient';

const fetchMock = jest.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test:3000/';
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
});

it('base URL에 경로를 붙여 JSON 본문을 보내고 성공 본문을 반환한다', async () => {
  fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

  await expect(
    apiRequest('POST', '/auth/social/login', { body: { provider: 'kakao' } }),
  ).resolves.toEqual({ ok: true });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://api.test:3000/auth/social/login');
  expect(init).toMatchObject({
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'kakao' }),
  });
});

it('본문이 없으면 Content-Type과 body를 보내지 않는다', async () => {
  fetchMock.mockResolvedValue(jsonResponse(201, { id: 1 }));

  await apiRequest('POST', '/auth/social/apple/start');

  const [, init] = fetchMock.mock.calls[0];
  expect(init.body).toBeUndefined();
  expect(init.headers).toEqual({ Accept: 'application/json' });
});

it('204는 본문을 읽지 않고 undefined를 반환한다', async () => {
  const json = jest.fn();
  fetchMock.mockResolvedValue({ ok: true, status: 204, json });

  await expect(
    apiRequest('POST', '/auth/logout', { body: { refreshToken: 'r' } }),
  ).resolves.toBeUndefined();
  expect(json).not.toHaveBeenCalled();
});

it('오류 envelope를 ApiError(status, code)로 변환한다', async () => {
  fetchMock.mockResolvedValue(
    jsonResponse(401, {
      error: { code: 'SOCIAL_AUTHENTICATION_FAILED', message: '실패' },
    }),
  );

  const error = await apiRequest('POST', '/auth/social/login').catch(
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({
    status: 401,
    code: 'SOCIAL_AUTHENTICATION_FAILED',
  });
});

it('JSON이 아닌 오류 응답은 UNKNOWN 코드로 변환한다', async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 502,
    json: () => Promise.reject(new SyntaxError('bad json')),
  });

  await expect(apiRequest('GET', '/')).rejects.toMatchObject({
    status: 502,
    code: 'UNKNOWN',
  });
});

it('네트워크 실패는 status 0 NETWORK_ERROR로 변환한다', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));

  await expect(apiRequest('GET', '/')).rejects.toMatchObject({
    status: 0,
    code: 'NETWORK_ERROR',
  });
});

it('API 주소가 없으면 요청하지 않고 API_NOT_CONFIGURED로 던진다', async () => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;

  await expect(apiRequest('GET', '/')).rejects.toMatchObject({
    status: 0,
    code: 'API_NOT_CONFIGURED',
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('추가 헤더를 기본 헤더와 함께 보내고 DELETE를 지원한다', async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 204, json: jest.fn() });

  await apiRequest('DELETE', '/users/me', {
    headers: { Authorization: 'Bearer t' },
  });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://api.test:3000/users/me');
  expect(init.method).toBe('DELETE');
  expect(init.headers).toEqual({
    Accept: 'application/json',
    Authorization: 'Bearer t',
  });
});
