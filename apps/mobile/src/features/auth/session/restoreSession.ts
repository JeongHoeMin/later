import type { AuthenticatedUserResponse } from '../api/authApi';
import type { AuthSession } from '../types';
import { authorizedRequest, SessionExpiredError } from './authorizedRequest';
import { getRefreshToken } from './tokenStorage';

export type RestoreResult =
  { type: 'signedIn'; session: AuthSession } | { type: 'signedOut' };

// 앱 시작 시 저장된 세션을 확인한다. 갱신 응답에는 user가 없으므로 /auth/me로 회원 ID를 얻는다.
// 네트워크·서버 오류는 토큰을 유지한 채 던져 호출자가 재시도하게 한다.
export async function restoreSession(): Promise<RestoreResult> {
  if (!(await getRefreshToken())) return { type: 'signedOut' };
  try {
    const { user } = await authorizedRequest<AuthenticatedUserResponse>(
      'GET',
      '/auth/me',
    );
    return { type: 'signedIn', session: { userId: user.id } };
  } catch (error) {
    if (error instanceof SessionExpiredError) return { type: 'signedOut' };
    throw error;
  }
}
