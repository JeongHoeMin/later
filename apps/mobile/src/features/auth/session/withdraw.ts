import { authorizedRequest, SessionExpiredError } from './authorizedRequest';
import { clearSessionTokens } from './tokenStorage';

// 서버가 회원·소셜 연결·모든 세션을 즉시 삭제한다. 복구할 수 없다.
// 세션이 이미 만료·탈퇴(SessionExpiredError)면 로컬 토큰이 지워진 상태로 완료한다.
export async function withdraw(): Promise<void> {
  try {
    await authorizedRequest<void>('DELETE', '/users/me');
  } catch (error) {
    if (error instanceof SessionExpiredError) return;
    throw error;
  }
  await clearSessionTokens();
}
