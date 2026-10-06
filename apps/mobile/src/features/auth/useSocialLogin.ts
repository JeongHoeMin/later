import { useRef, useState } from 'react';
import { loginWithProvider } from './loginWithProvider';
import { SocialLoginError } from './social/SocialLoginError';
import type { AuthSession, SocialProvider } from './types';

const PROVIDER_NAMES: Record<SocialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
  apple: 'Apple',
};

function toErrorMessage(provider: SocialProvider, error: unknown): string {
  const name = PROVIDER_NAMES[provider];
  const reason = error instanceof SocialLoginError ? error.reason : 'failed';
  switch (reason) {
    case 'not_configured':
      return `${name} 로그인 설정이 필요해요.`;
    case 'rejected':
      return `${name} 로그인을 확인하지 못했어요. 다시 로그인해 주세요.`;
    case 'unavailable':
      return '지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.';
    case 'failed':
      return `${name} 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.`;
  }
}

export function useSocialLogin(
  onAuthenticated: (session: AuthSession) => void,
) {
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 버튼 비활성화가 반영되기 전 연속 입력으로 시도가 겹치지 않게 한다.
  const inFlight = useRef(false);

  async function signIn(provider: SocialProvider) {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoadingProvider(provider);
    setErrorMessage(null);
    try {
      const result = await loginWithProvider(provider);
      if (result.type === 'success') onAuthenticated(result.session);
    } catch (error) {
      if (__DEV__) console.warn('[auth] 로그인 실패', error);
      setErrorMessage(toErrorMessage(provider, error));
    } finally {
      inFlight.current = false;
      setLoadingProvider(null);
    }
  }

  return { loadingProvider, errorMessage, signIn };
}
