import { login, type KakaoOAuthToken } from '@react-native-seoul/kakao-login';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  getAvailableProviders,
  signInWithApple,
  signInWithGoogle,
  signInWithKakao,
  SocialLoginError,
} from '..';

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

// login은 오버로드가 있어 jest.mocked가 마지막(web) 시그니처를 고르므로 네이티브 시그니처로 좁힌다.
const kakaoLogin = login as () => Promise<KakaoOAuthToken>;

const ENV = {
  EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 'kakao-key',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios.apps.googleusercontent.com',
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(process.env, ENV);
});

afterEach(() => {
  for (const key of Object.keys(ENV)) delete process.env[key];
});

async function expectSocialLoginError(
  promise: Promise<unknown>,
  provider: string,
  reason: string,
) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SocialLoginError);
  expect(error).toMatchObject({ provider, reason });
}

const googleUser = {
  id: '1',
  email: 'a@b.c',
  name: null,
  photo: null,
  familyName: null,
  givenName: null,
};

describe('kakao', () => {
  it('로그인 성공 시 Access Token을 반환한다', async () => {
    jest.mocked(kakaoLogin).mockResolvedValue({
      accessToken: 'kakao-access',
      idToken: 'kakao-id',
      refreshToken: 'kakao-refresh',
      accessTokenExpiresAt: new Date(),
      refreshTokenExpiresAt: new Date(),
      scopes: [],
    });

    await expect(signInWithKakao()).resolves.toEqual({
      type: 'success',
      token: 'kakao-access',
    });
  });

  it.each([
    'user cancelled.',
    'ClientFailed(Cancelled): no message',
    'access_denied: User denied access',
  ])('취소 오류(%s)는 cancelled로 반환한다', async (message) => {
    jest.mocked(kakaoLogin).mockRejectedValue(new Error(message));

    await expect(signInWithKakao()).resolves.toEqual({ type: 'cancelled' });
  });

  it('그 외 SDK 오류는 SocialLoginError(failed)로 던진다', async () => {
    jest.mocked(kakaoLogin).mockRejectedValue(new Error('KOE101'));

    await expectSocialLoginError(signInWithKakao(), 'kakao', 'failed');
  });

  it('앱 키가 없으면 SDK를 호출하지 않고 not_configured로 던진다', async () => {
    delete process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;

    await expectSocialLoginError(signInWithKakao(), 'kakao', 'not_configured');
    expect(kakaoLogin).not.toHaveBeenCalled();
  });
});

describe('google', () => {
  it('서버 audience(web client ID)로 설정하고 ID Token을 반환한다', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: {
        idToken: 'google-id',
        serverAuthCode: null,
        scopes: [],
        user: googleUser,
      },
    });

    await expect(signInWithGoogle()).resolves.toEqual({
      type: 'success',
      token: 'google-id',
    });
    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: ENV.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: ENV.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
  });

  it('cancelled 응답은 cancelled로 반환한다', async () => {
    jest
      .mocked(GoogleSignin.signIn)
      .mockResolvedValue({ type: 'cancelled', data: null });

    await expect(signInWithGoogle()).resolves.toEqual({ type: 'cancelled' });
  });

  it('idToken이 없으면 failed로 던진다', async () => {
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: {
        idToken: null,
        serverAuthCode: null,
        scopes: [],
        user: googleUser,
      },
    });

    await expectSocialLoginError(signInWithGoogle(), 'google', 'failed');
  });

  it('SDK 오류는 failed로 던진다', async () => {
    jest
      .mocked(GoogleSignin.signIn)
      .mockRejectedValue(
        Object.assign(new Error('no play'), { code: 'PLAY_SERVICES' }),
      );

    await expectSocialLoginError(signInWithGoogle(), 'google', 'failed');
  });

  it('web client ID가 없으면 not_configured로 던진다', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

    await expectSocialLoginError(
      signInWithGoogle(),
      'google',
      'not_configured',
    );
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  });
});

describe('apple', () => {
  const appleCredential = {
    user: 'apple-user',
    state: null,
    fullName: null,
    email: null,
    realUserStatus: 1,
    identityToken: 'apple-id-token',
    authorizationCode: 'apple-code',
  };

  it('받은 nonce를 해시하지 않고 그대로 전달하고 identityToken을 반환한다', async () => {
    jest
      .mocked(AppleAuthentication.signInAsync)
      .mockResolvedValue(appleCredential);

    await expect(signInWithApple('server-nonce')).resolves.toEqual({
      type: 'success',
      token: 'apple-id-token',
    });
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      nonce: 'server-nonce',
    });
  });

  it('ERR_REQUEST_CANCELED는 cancelled로 반환한다', async () => {
    jest
      .mocked(AppleAuthentication.signInAsync)
      .mockRejectedValue(
        Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }),
      );

    await expect(signInWithApple('n')).resolves.toEqual({ type: 'cancelled' });
  });

  it('identityToken이 없으면 failed로 던진다', async () => {
    jest
      .mocked(AppleAuthentication.signInAsync)
      .mockResolvedValue({ ...appleCredential, identityToken: null });

    await expectSocialLoginError(signInWithApple('n'), 'apple', 'failed');
  });
});

describe('getAvailableProviders', () => {
  it('iOS는 Apple을 포함한다', () => {
    expect(getAvailableProviders('ios')).toEqual([
      'kakao',
      'naver',
      'google',
      'apple',
    ]);
  });

  it('Android는 Apple을 제외한다', () => {
    expect(getAvailableProviders('android')).toEqual([
      'kakao',
      'naver',
      'google',
    ]);
  });
});
