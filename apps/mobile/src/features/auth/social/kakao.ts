import { login } from '@react-native-seoul/kakao-login';
import type { ProviderSignInResult } from '../types';
import { getKakaoConfig } from './config';
import { SocialLoginError } from './SocialLoginError';

// 카카오 SDK는 취소를 별도 코드 없이 메시지로만 구분한다.
// Android: ClientError(Cancelled) "user cancelled.", AuthError access_denied
// iOS: "ClientFailed(Cancelled): ..."
const CANCELLED_MESSAGE = /cancel|access_denied/i;

export async function signInWithKakao(): Promise<ProviderSignInResult> {
  getKakaoConfig();

  try {
    const token = await login();
    return { type: 'success', token: token.accessToken };
  } catch (error) {
    if (error instanceof Error && CANCELLED_MESSAGE.test(error.message)) {
      return { type: 'cancelled' };
    }
    throw new SocialLoginError('kakao', 'failed', { cause: error });
  }
}
