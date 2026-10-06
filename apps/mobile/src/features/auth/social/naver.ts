import * as WebBrowser from 'expo-web-browser';
import { SocialLoginError } from './SocialLoginError';

// 서버 NAVER_LOGIN_APP_RETURN_URL과 같아야 한다(app.json scheme: kr.pe.hoe.later).
// 서버 Callback이 state를 검증한 뒤 이 주소로 loginAttemptId만 붙여 303으로 돌려보낸다.
export const NAVER_RETURN_URL = 'kr.pe.hoe.later://auth/naver';

function readReturnedAttemptId(url: string): string | null {
  const withoutFragment = url.split('#')[0];
  const queryStart = withoutFragment.indexOf('?');
  const base =
    queryStart === -1 ? withoutFragment : withoutFragment.slice(0, queryStart);
  if (base !== NAVER_RETURN_URL) return null;

  const query = queryStart === -1 ? '' : withoutFragment.slice(queryStart + 1);
  try {
    const ids = query
      .split('&')
      .map((pair) => pair.split('='))
      .filter(([key]) => decodeURIComponent(key) === 'loginAttemptId')
      .map(([, value = '']) => decodeURIComponent(value));
    return ids.length === 1 && ids[0] ? ids[0] : null;
  } catch {
    return null;
  }
}

// 서버가 만든 authorizationUrl을 수정하지 않고 인증 세션으로 연다.
// 돌아온 주소가 이 시도의 반환 URL·loginAttemptId와 일치할 때만 성공으로 본다.
export async function authorizeWithNaver(attempt: {
  loginAttemptId: string;
  authorizationUrl: string;
}): Promise<{ type: 'success' } | { type: 'cancelled' }> {
  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(
      attempt.authorizationUrl,
      NAVER_RETURN_URL,
    );
  } catch (error) {
    throw new SocialLoginError('naver', 'failed', { cause: error });
  }

  if (result.type !== 'success') return { type: 'cancelled' };
  if (readReturnedAttemptId(result.url) !== attempt.loginAttemptId) {
    throw new SocialLoginError('naver', 'failed');
  }
  return { type: 'success' };
}
