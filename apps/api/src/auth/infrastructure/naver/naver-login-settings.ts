import type { NaverLoginSettings } from '../../application/ports/naver-login-attempt.repository.js';
import { SocialAuthenticationUnavailableError } from '../../domain/errors/social-authentication-unavailable.error.js';
export function readNaverLoginSettings(): NaverLoginSettings {
  try {
    const clientId = process.env.NAVER_CLIENT_ID ?? '';
    if (!clientId || /\s/.test(clientId)) throw new Error();
    const callback = new URL(process.env.NAVER_LOGIN_CALLBACK_URL ?? '');
    const app = new URL(process.env.NAVER_LOGIN_APP_RETURN_URL ?? '');
    for (const url of [callback, app])
      if (
        !url.hostname ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
    if (
      callback.protocol !== 'https:' ||
      callback.pathname !== '/auth/social/naver/callback'
    )
      throw new Error();
    if (
      app.protocol !== 'https:' &&
      (!/^[a-z][a-z0-9+.-]*:$/.test(app.protocol) ||
        [
          'http:',
          'javascript:',
          'data:',
          'file:',
          'ftp:',
          'intent:',
          'about:',
        ].includes(app.protocol))
    )
      throw new Error();
    return {
      clientId,
      callbackUrl: callback.toString(),
      appReturnUrl: app.toString(),
    };
  } catch {
    throw new SocialAuthenticationUnavailableError();
  }
}
