import { login, type KakaoOAuthToken } from '@react-native-seoul/kakao-login';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { ApiError, apiRequest } from '../../../shared/api/apiClient';
import { loginWithProvider } from '../loginWithProvider';
import { SocialLoginError } from '../social';
import { saveSessionTokens } from '../session/tokenStorage';

jest.mock('@react-native-seoul/kakao-login', () => ({ login: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
  },
}));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('../../../shared/api/apiClient', () => ({
  ...jest.requireActual('../../../shared/api/apiClient'),
  apiRequest: jest.fn(),
}));
jest.mock('../session/tokenStorage', () => ({ saveSessionTokens: jest.fn() }));

const kakaoLogin = login as () => Promise<KakaoOAuthToken>;
const api = jest.mocked(apiRequest);

const LOGIN_RESPONSE = {
  user: { id: 'user-1' },
  accessToken: 'later-access',
  refreshToken: 'later-refresh',
  tokenType: 'Bearer',
  expiresIn: 900,
};

const ENV = {
  EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 'kakao-key',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com',
};

let now = 1_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(process.env, ENV);
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  for (const key of Object.keys(ENV)) delete process.env[key];
  jest.restoreAllMocks();
});

function routeApi(routes: Record<string, unknown | (() => unknown)>) {
  api.mockImplementation(async (method, path) => {
    const route = routes[`${method} ${path}`];
    if (route === undefined) throw new Error(`unexpected ${method} ${path}`);
    return typeof route === 'function' ? route() : route;
  });
}

function calledPaths() {
  return api.mock.calls.map(([method, path]) => `${method} ${path}`);
}

describe('kakao', () => {
  const token = {
    accessToken: 'kakao-access',
    idToken: '',
    refreshToken: '',
    accessTokenExpiresAt: new Date(),
    refreshTokenExpiresAt: new Date(),
    scopes: [],
  };

  it('Access Token을 credential로 로그인하고 서비스 토큰을 저장한다', async () => {
    jest.mocked(kakaoLogin).mockResolvedValue(token);
    routeApi({ 'POST /auth/social/login': LOGIN_RESPONSE });

    await expect(loginWithProvider('kakao')).resolves.toEqual({
      type: 'success',
      session: { userId: 'user-1' },
    });
    expect(api).toHaveBeenCalledWith('POST', '/auth/social/login', {
      body: { provider: 'kakao', credential: 'kakao-access' },
    });
    expect(saveSessionTokens).toHaveBeenCalledWith({
      accessToken: 'later-access',
      refreshToken: 'later-refresh',
    });
  });

  it('SDK 취소 시 API를 호출하지 않는다', async () => {
    jest.mocked(kakaoLogin).mockRejectedValue(new Error('user cancelled.'));

    await expect(loginWithProvider('kakao')).resolves.toEqual({
      type: 'cancelled',
    });
    expect(api).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'SOCIAL_AUTHENTICATION_FAILED', 'rejected'],
    [503, 'INTERNAL_SERVER_ERROR', 'unavailable'],
    [500, 'INTERNAL_SERVER_ERROR', 'unavailable'],
    [0, 'NETWORK_ERROR', 'unavailable'],
    [400, 'BAD_REQUEST', 'failed'],
  ])(
    'API %i(%s)는 %s 오류로 변환하고 토큰을 저장하지 않는다',
    async (status, code, reason) => {
      jest.mocked(kakaoLogin).mockResolvedValue(token);
      api.mockRejectedValue(new ApiError(status, code));

      const error = await loginWithProvider('kakao').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SocialLoginError);
      expect(error).toMatchObject({ provider: 'kakao', reason });
      expect(saveSessionTokens).not.toHaveBeenCalled();
    },
  );
});

describe('google', () => {
  it('ID Token만 credential로 보낸다', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'google-id',
        serverAuthCode: null,
        scopes: [],
        user: {
          id: '1',
          email: 'a@b.c',
          name: null,
          photo: null,
          familyName: null,
          givenName: null,
        },
      },
    });
    routeApi({ 'POST /auth/social/login': LOGIN_RESPONSE });

    await loginWithProvider('google');

    expect(api).toHaveBeenCalledWith('POST', '/auth/social/login', {
      body: { provider: 'google', credential: 'google-id' },
    });
  });
});

describe('apple', () => {
  const START = {
    loginAttemptId: 'a43a185e-b819-44d7-90ca-e11d218c3145',
    nonce: 'server-nonce',
    expiresIn: 300,
  };
  const credential = {
    user: 'apple-user',
    state: null,
    fullName: null,
    email: null,
    realUserStatus: 1,
    identityToken: 'apple-id-token',
    authorizationCode: 'apple-code',
  };

  it('start의 nonce를 그대로 Apple에 넣고 같은 시도 ID로 로그인한다', async () => {
    routeApi({
      'POST /auth/social/apple/start': START,
      'POST /auth/social/login': LOGIN_RESPONSE,
    });
    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue(credential);

    await expect(loginWithProvider('apple')).resolves.toMatchObject({
      type: 'success',
    });
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'server-nonce' }),
    );
    expect(calledPaths()).toEqual([
      'POST /auth/social/apple/start',
      'POST /auth/social/login',
    ]);
    expect(api).toHaveBeenLastCalledWith('POST', '/auth/social/login', {
      body: {
        provider: 'apple',
        credential: 'apple-id-token',
        loginAttemptId: START.loginAttemptId,
      },
    });
  });

  it('취소하면 시도를 폐기하고 로그인 API를 호출하지 않는다', async () => {
    routeApi({ 'POST /auth/social/apple/start': START });
    jest
      .mocked(AppleAuthentication.signInAsync)
      .mockRejectedValue(
        Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }),
      );

    await expect(loginWithProvider('apple')).resolves.toEqual({
      type: 'cancelled',
    });
    expect(calledPaths()).toEqual(['POST /auth/social/apple/start']);
  });

  it('시도가 만료된 뒤 받은 결과는 보내지 않는다', async () => {
    routeApi({ 'POST /auth/social/apple/start': START });
    jest
      .mocked(AppleAuthentication.signInAsync)
      .mockImplementation(async () => {
        now += 300_000;
        return credential;
      });

    await expect(loginWithProvider('apple')).rejects.toMatchObject({
      provider: 'apple',
      reason: 'rejected',
    });
    expect(calledPaths()).toEqual(['POST /auth/social/apple/start']);
  });

  it('start가 503이면 Apple 인증을 시작하지 않는다', async () => {
    api.mockRejectedValue(new ApiError(503, 'INTERNAL_SERVER_ERROR'));

    await expect(loginWithProvider('apple')).rejects.toMatchObject({
      reason: 'unavailable',
    });
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
  });
});

describe('naver', () => {
  const START = {
    loginAttemptId: 'b1c2d3e4-0000-4000-8000-000000000001',
    attemptSecret: 'attempt-secret',
    authorizationUrl:
      'https://nid.naver.com/oauth2.0/authorize?response_type=code&state=s',
    expiresIn: 300,
  };
  const RETURN_URL = 'kr.pe.hoe.later://auth/naver';
  const browser = jest.mocked(WebBrowser.openAuthSessionAsync);

  it('authorizationUrl을 그대로 열고, 돌아온 시도 ID가 같으면 공통 로그인 경로에 시도 ID와 비밀값을 보낸다', async () => {
    routeApi({
      'POST /auth/social/naver/start': START,
      'POST /auth/social/login': LOGIN_RESPONSE,
    });
    browser.mockResolvedValue({
      type: 'success',
      url: `${RETURN_URL}?loginAttemptId=${START.loginAttemptId}`,
    });

    await expect(loginWithProvider('naver')).resolves.toEqual({
      type: 'success',
      session: { userId: 'user-1' },
    });
    expect(browser).toHaveBeenCalledWith(START.authorizationUrl, RETURN_URL);
    expect(calledPaths()).toEqual([
      'POST /auth/social/naver/start',
      'POST /auth/social/login',
    ]);
    expect(api).toHaveBeenLastCalledWith('POST', '/auth/social/login', {
      body: {
        provider: 'naver',
        loginAttemptId: START.loginAttemptId,
        attemptSecret: START.attemptSecret,
      },
    });
    expect(saveSessionTokens).toHaveBeenCalled();
  });

  it.each(['cancel', 'dismiss'] as const)(
    '브라우저 %s는 cancelled이며 완료하지 않는다',
    async (type) => {
      routeApi({ 'POST /auth/social/naver/start': START });
      browser.mockResolvedValue({ type } as WebBrowser.WebBrowserResult);

      await expect(loginWithProvider('naver')).resolves.toEqual({
        type: 'cancelled',
      });
      expect(calledPaths()).toEqual(['POST /auth/social/naver/start']);
    },
  );

  it.each([
    ['다른 시도 ID', `${RETURN_URL}?loginAttemptId=other-id`],
    ['시도 ID 누락', RETURN_URL],
    [
      '중복 시도 ID',
      `${RETURN_URL}?loginAttemptId=${START.loginAttemptId}&loginAttemptId=x`,
    ],
    [
      '다른 반환 주소',
      `kr.pe.hoe.later://evil/naver?loginAttemptId=${START.loginAttemptId}`,
    ],
  ])('%s이면 완료하지 않는다', async (_label, url) => {
    routeApi({ 'POST /auth/social/naver/start': START });
    browser.mockResolvedValue({ type: 'success', url });

    await expect(loginWithProvider('naver')).rejects.toMatchObject({
      provider: 'naver',
      reason: 'failed',
    });
    expect(calledPaths()).toEqual(['POST /auth/social/naver/start']);
  });

  it('시도가 만료된 뒤 돌아오면 완료하지 않는다', async () => {
    routeApi({ 'POST /auth/social/naver/start': START });
    browser.mockImplementation(async () => {
      now += 300_000;
      return {
        type: 'success',
        url: `${RETURN_URL}?loginAttemptId=${START.loginAttemptId}`,
      };
    });

    await expect(loginWithProvider('naver')).rejects.toMatchObject({
      reason: 'rejected',
    });
    expect(calledPaths()).toEqual(['POST /auth/social/naver/start']);
  });

  it('최종 로그인이 401(취소·만료·재사용)이면 rejected로 변환한다', async () => {
    routeApi({
      'POST /auth/social/naver/start': START,
      'POST /auth/social/login': () => {
        throw new ApiError(401, 'SOCIAL_AUTHENTICATION_FAILED');
      },
    });
    browser.mockResolvedValue({
      type: 'success',
      url: `${RETURN_URL}?loginAttemptId=${START.loginAttemptId}`,
    });

    await expect(loginWithProvider('naver')).rejects.toMatchObject({
      reason: 'rejected',
    });
    expect(saveSessionTokens).not.toHaveBeenCalled();
  });
});
