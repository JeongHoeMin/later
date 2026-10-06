import type { SocialProvider } from '../types';

// Apple 로그인은 iOS 네이티브만 지원한다. Android는 웹 Service ID 흐름이 필요하다.
export function getAvailableProviders(os: string): SocialProvider[] {
  const providers: SocialProvider[] = ['kakao', 'naver', 'google'];
  return os === 'ios' ? [...providers, 'apple'] : providers;
}
