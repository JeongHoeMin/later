import { apiRequest } from '../../../shared/api/apiClient';

// Later 인증 API 계약(feat/auth). 실행 중인 서버의 GET /docs-json과 대조한다.
export type ServiceLoginResponse = {
  user: { id: string };
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

// 네 제공자 모두 이 경로로 최종 서비스 로그인한다. 서버는 provider별 필드 외의 값을 400으로 거부한다.
export type SocialLoginRequest =
  | { provider: 'kakao' | 'google'; credential: string }
  | { provider: 'apple'; credential: string; loginAttemptId: string }
  | { provider: 'naver'; loginAttemptId: string; attemptSecret: string };

export type AppleLoginStart = {
  loginAttemptId: string;
  nonce: string;
  expiresIn: number;
};

export type NaverLoginStart = {
  loginAttemptId: string;
  attemptSecret: string;
  authorizationUrl: string;
  expiresIn: number;
};

export function socialLogin(body: SocialLoginRequest) {
  return apiRequest<ServiceLoginResponse>('POST', '/auth/social/login', {
    body,
  });
}

export function startAppleLogin() {
  return apiRequest<AppleLoginStart>('POST', '/auth/social/apple/start');
}

export function startNaverLogin() {
  return apiRequest<NaverLoginStart>('POST', '/auth/social/naver/start');
}

export type SessionTokensResponse = Omit<ServiceLoginResponse, 'user'>;

export type AuthenticatedUserResponse = { user: { id: string } };

// 성공 시 이전 Refresh Token은 소비된다. 호출자는 갱신을 직렬화하고 새 토큰으로 교체한다.
export function refreshTokens(refreshToken: string) {
  return apiRequest<SessionTokensResponse>('POST', '/auth/token/refresh', {
    body: { refreshToken },
  });
}

export function logoutSession(refreshToken: string) {
  return apiRequest<void>('POST', '/auth/logout', { body: { refreshToken } });
}
