export type SocialProvider = 'kakao' | 'naver' | 'google' | 'apple';

// 제공자 SDK가 돌려준 서버 검증용 값(카카오 Access Token, 구글·Apple ID Token).
export type ProviderSignInResult =
  { type: 'success'; token: string } | { type: 'cancelled' };

export type AuthSession = { userId: string };
