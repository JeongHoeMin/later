export type SocialLoginInput =
  | { provider: 'google' | 'kakao'; credential: string }
  | { provider: 'naver'; credential: string; state: string }
  | { provider: 'apple'; credential: string; loginAttemptId: string };

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface SocialLoginResult extends SessionTokens {
  user: { id: string };
}

export interface AppleLoginAttempt {
  loginAttemptId: string;
  nonce: string;
  expiresIn: number;
}

export class AuthApiError extends Error {
  constructor(
    public readonly kind: 'http' | 'network' | 'invalid-response' | 'timeout',
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(
      kind === 'network'
        ? '인증 서버에 연결할 수 없습니다.'
        : '인증 요청을 완료할 수 없습니다.',
    );
    this.name = 'AuthApiError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTokens(value: unknown): value is SessionTokens {
  return (
    isObject(value) &&
    nonempty(value.accessToken) &&
    nonempty(value.refreshToken) &&
    value.tokenType === 'Bearer' &&
    typeof value.expiresIn === 'number' &&
    Number.isSafeInteger(value.expiresIn) &&
    value.expiresIn > 0
  );
}

export class AuthApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly request: typeof fetch = fetch,
  ) {
    try {
      const url = new URL(baseUrl);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      this.baseUrl = url.toString().replace(/\/+$/, '');
    } catch {
      throw new Error('인증 API 주소 설정을 확인해주세요.');
    }
  }

  async login(input: SocialLoginInput): Promise<SocialLoginResult> {
    const value = await this.post('/auth/social/login', input, 200);
    if (
      !isTokens(value) ||
      !isObject(value) ||
      !isObject(value.user) ||
      !nonempty(value.user.id)
    )
      throw new AuthApiError('invalid-response');
    return {
      accessToken: value.accessToken,
      refreshToken: value.refreshToken,
      tokenType: value.tokenType,
      expiresIn: value.expiresIn,
      user: { id: value.user.id },
    };
  }

  async startApple(): Promise<AppleLoginAttempt> {
    const value = await this.post('/auth/social/apple/start', {}, 201);
    if (
      !isObject(value) ||
      !nonempty(value.loginAttemptId) ||
      !nonempty(value.nonce) ||
      typeof value.expiresIn !== 'number' ||
      !Number.isSafeInteger(value.expiresIn) ||
      value.expiresIn <= 0
    )
      throw new AuthApiError('invalid-response');
    return {
      loginAttemptId: value.loginAttemptId,
      nonce: value.nonce,
      expiresIn: value.expiresIn,
    };
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const value = await this.post('/auth/token/refresh', { refreshToken }, 200);
    if (!isTokens(value)) throw new AuthApiError('invalid-response');
    return value;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.post('/auth/logout', { refreshToken }, 204);
  }

  private async post(
    path: string,
    body: unknown,
    expectedStatus: number,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await this.request(this.baseUrl + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const value: unknown = await response.json().catch(() => {
          if (controller.signal.aborted) throw new AuthApiError('timeout');
          return null;
        });
        const code =
          isObject(value) &&
          isObject(value.error) &&
          typeof value.error.code === 'string' &&
          [
            'BAD_REQUEST',
            'SOCIAL_AUTHENTICATION_FAILED',
            'INVALID_REFRESH_TOKEN',
            'INTERNAL_SERVER_ERROR',
          ].includes(value.error.code)
            ? value.error.code
            : undefined;
        throw new AuthApiError('http', response.status, code);
      }
      if (response.status !== expectedStatus)
        throw new AuthApiError('invalid-response');
      if (expectedStatus === 204) return undefined;
      try {
        return await response.json();
      } catch {
        if (controller.signal.aborted) throw new AuthApiError('timeout');
        throw new AuthApiError('invalid-response');
      }
    } catch (error) {
      if (error instanceof AuthApiError) throw error;
      throw new AuthApiError(controller.signal.aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
  }
}
