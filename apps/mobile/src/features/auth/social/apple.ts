import * as AppleAuthentication from 'expo-apple-authentication';
import type { ProviderSignInResult } from '../types';
import { SocialLoginError } from './SocialLoginError';

// nonce는 서버 start API가 발급한 값을 그대로 넘긴다.
// expo-apple-authentication은 nonce를 해시하지 않고 ASAuthorizationAppleIDRequest에 그대로 전달한다.
export async function signInWithApple(
  nonce: string,
): Promise<ProviderSignInResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED') {
      return { type: 'cancelled' };
    }
    throw new SocialLoginError('apple', 'failed', { cause: error });
  }

  if (!credential.identityToken) throw new SocialLoginError('apple', 'failed');
  return { type: 'success', token: credential.identityToken };
}
