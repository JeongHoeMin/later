import { logoutSession } from '../api/authApi';
import { clearSessionTokens, getRefreshToken } from './tokenStorage';

// 서버 세션 폐기에 실패해도 사용자의 로그아웃 의도를 우선해 로컬 토큰은 지운다.
// 이 경우 서버 세션은 만료 시점까지 남는다.
export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  try {
    if (refreshToken) await logoutSession(refreshToken);
  } catch (error) {
    if (__DEV__) console.warn('[auth] 서버 로그아웃 실패', error);
  } finally {
    await clearSessionTokens();
  }
}
