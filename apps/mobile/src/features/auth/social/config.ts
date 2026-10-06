import type { SocialProvider } from '../types';
import { SocialLoginError } from './SocialLoginError';

// EXPO_PUBLIC_* 값은 번들에 인라인되므로 process.env.NAME 형태로만 접근한다.
// 호출 시점에 읽어 키가 없을 때 provider별 not_configured 오류로 알린다.
function required(provider: SocialProvider, value: string | undefined): string {
  if (!value) throw new SocialLoginError(provider, 'not_configured');
  return value;
}

export function getKakaoConfig() {
  return {
    nativeAppKey: required(
      'kakao',
      process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY,
    ),
  };
}

export function getGoogleConfig() {
  return {
    webClientId: required(
      'google',
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    ),
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  };
}
