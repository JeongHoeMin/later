import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import type { ProviderSignInResult } from '../types';
import { getGoogleConfig } from './config';
import { SocialLoginError } from './SocialLoginError';

export async function signInWithGoogle(): Promise<ProviderSignInResult> {
  // webClientId(서버 GOOGLE_CLIENT_ID)를 지정해야 서버 audience와 같은 idToken이 발급된다.
  GoogleSignin.configure(getGoogleConfig());

  let idToken: string | null;
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return { type: 'cancelled' };
    idToken = response.data.idToken;
  } catch (error) {
    throw new SocialLoginError('google', 'failed', { cause: error });
  }

  if (!idToken) throw new SocialLoginError('google', 'failed');
  return { type: 'success', token: idToken };
}
