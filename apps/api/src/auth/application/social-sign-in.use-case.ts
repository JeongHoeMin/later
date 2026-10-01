import type {
  SocialLoginUseCase,
  SocialLoginCommand,
} from './social-login.use-case.js';
import type {
  IssueSessionUseCase,
  SessionTokens,
} from './issue-session.use-case.js';
export type SocialSignInResult = SessionTokens & { user: { id: string } };
export class SocialSignInUseCase {
  constructor(
    private readonly social: Pick<SocialLoginUseCase, 'execute'>,
    private readonly sessions: Pick<IssueSessionUseCase, 'execute'>,
  ) {}
  async execute(command: SocialLoginCommand): Promise<SocialSignInResult> {
    const user = await this.social.execute(command);
    const tokens = await this.sessions.execute(user.id);
    return { user: { id: user.id }, ...tokens };
  }
}
