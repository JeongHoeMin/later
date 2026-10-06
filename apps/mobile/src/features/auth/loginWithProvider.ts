import { ApiError } from '../../shared/api/apiClient';
import {
  socialLogin,
  startAppleLogin,
  startNaverLogin,
  type ServiceLoginResponse,
} from './api/authApi';
import { saveSessionTokens } from './session/tokenStorage';
import { signInWithApple } from './social/apple';
import { signInWithGoogle } from './social/google';
import { signInWithKakao } from './social/kakao';
import { authorizeWithNaver } from './social/naver';
import { SocialLoginError } from './social/SocialLoginError';
import type { AuthSession, SocialProvider } from './types';

export type LoginResult =
  { type: 'success'; session: AuthSession } | { type: 'cancelled' };

type ServiceLoginResult =
  { type: 'success'; login: ServiceLoginResponse } | { type: 'cancelled' };

const CANCELLED = { type: 'cancelled' } as const;

// 401은 새 로그인이 필요한 거부, 400은 요청 계약 오류, 나머지(5xx·네트워크)는 일시 장애다.
function toSocialLoginError(provider: SocialProvider, error: unknown) {
  if (error instanceof SocialLoginError) return error;
  if (!(error instanceof ApiError)) {
    return new SocialLoginError(provider, 'failed', { cause: error });
  }
  const reason =
    error.status === 401
      ? 'rejected'
      : error.status === 400
        ? 'failed'
        : 'unavailable';
  return new SocialLoginError(provider, reason, { cause: error });
}

// Apple·네이버 시도는 서버가 정한 expiresIn이 지나면 폐기하고 새 로그인으로 재개한다.
function expiryOf(provider: SocialProvider, expiresIn: number) {
  const expiresAt = Date.now() + expiresIn * 1000;
  return () => {
    if (Date.now() >= expiresAt) {
      throw new SocialLoginError(provider, 'rejected');
    }
  };
}

async function loginWithTokenProvider(
  provider: 'kakao' | 'google',
): Promise<ServiceLoginResult> {
  const result =
    provider === 'kakao' ? await signInWithKakao() : await signInWithGoogle();
  if (result.type === 'cancelled') return CANCELLED;
  return {
    type: 'success',
    login: await socialLogin({ provider, credential: result.token }),
  };
}

async function loginWithApple(): Promise<ServiceLoginResult> {
  const attempt = await startAppleLogin();
  const ensureNotExpired = expiryOf('apple', attempt.expiresIn);

  const result = await signInWithApple(attempt.nonce);
  if (result.type === 'cancelled') return CANCELLED;
  ensureNotExpired();

  return {
    type: 'success',
    login: await socialLogin({
      provider: 'apple',
      credential: result.token,
      loginAttemptId: attempt.loginAttemptId,
    }),
  };
}

async function loginWithNaver(): Promise<ServiceLoginResult> {
  const attempt = await startNaverLogin();
  const ensureNotExpired = expiryOf('naver', attempt.expiresIn);

  const result = await authorizeWithNaver(attempt);
  if (result.type === 'cancelled') return CANCELLED;
  ensureNotExpired();

  return {
    type: 'success',
    login: await socialLogin({
      provider: 'naver',
      loginAttemptId: attempt.loginAttemptId,
      attemptSecret: attempt.attemptSecret,
    }),
  };
}

function runServiceLogin(provider: SocialProvider) {
  switch (provider) {
    case 'kakao':
    case 'google':
      return loginWithTokenProvider(provider);
    case 'apple':
      return loginWithApple();
    case 'naver':
      return loginWithNaver();
  }
}

export async function loginWithProvider(
  provider: SocialProvider,
): Promise<LoginResult> {
  try {
    const result = await runServiceLogin(provider);
    if (result.type === 'cancelled') return CANCELLED;

    const { user, accessToken, refreshToken } = result.login;
    await saveSessionTokens({ accessToken, refreshToken });
    return { type: 'success', session: { userId: user.id } };
  } catch (error) {
    throw toSocialLoginError(provider, error);
  }
}
