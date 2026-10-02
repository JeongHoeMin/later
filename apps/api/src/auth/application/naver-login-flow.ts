import type {
  NaverLoginAttemptRepository,
  NaverLoginSecurity,
  NaverLoginSettings,
} from './ports/naver-login-attempt.repository.js';
import type {
  SocialSignInUseCase,
  SocialSignInResult,
} from './social-sign-in.use-case.js';
import { SocialAuthenticationFailedError } from '../domain/errors/social-authentication-failed.error.js';
export class NaverLoginFlow {
  constructor(
    private readonly attempts: NaverLoginAttemptRepository,
    private readonly security: NaverLoginSecurity,
    private readonly signIn: Pick<SocialSignInUseCase, 'execute'>,
    private readonly settings: () => NaverLoginSettings,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async start(): Promise<{
    loginAttemptId: string;
    attemptSecret: string;
    authorizationUrl: string;
    expiresIn: number;
  }> {
    const settings = this.settings();
    const value = this.security.generate();
    await this.attempts.create({
      id: value.id,
      stateHash: this.security.hash(value.state),
      secretHash: this.security.hash(value.attemptSecret),
      expiresAt: new Date(this.now().getTime() + 300000),
    });
    const url = new URL('https://nid.naver.com/oauth2.0/authorize');
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: settings.clientId,
      redirect_uri: settings.callbackUrl,
      state: value.state,
    }).toString();
    return {
      loginAttemptId: value.id,
      attemptSecret: value.attemptSecret,
      authorizationUrl: url.toString(),
      expiresIn: 300,
    };
  }
  async callback(state: string, code: string | null): Promise<string> {
    const settings = this.settings();
    const sealed = this.security.seal(code === null ? null : { code, state });
    const id = await this.attempts.acceptCallback(
      this.security.hash(state),
      sealed,
      this.now(),
    );
    if (!id) throw new SocialAuthenticationFailedError();
    const url = new URL(settings.appReturnUrl);
    url.searchParams.set('loginAttemptId', id);
    return url.toString();
  }
  async complete(id: string, secret: string): Promise<SocialSignInResult> {
    this.settings();
    const sealed = await this.attempts.consume(
      id,
      this.security.hash(secret),
      this.now(),
    );
    if (!sealed) throw new SocialAuthenticationFailedError();
    const grant = this.security.open(sealed);
    if (!grant) throw new SocialAuthenticationFailedError();
    return this.signIn.execute({
      provider: 'naver',
      credential: grant.code,
      state: grant.state,
    });
  }
}
