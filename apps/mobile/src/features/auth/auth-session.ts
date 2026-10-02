import {
  AuthApiError,
  type AuthApiClient,
  type SessionTokens,
  type SocialLoginInput,
} from './auth-api-client.js';

export interface StoredSession {
  userId: string;
  provider: SocialLoginInput['provider'];
  refreshToken: string;
}

export interface SessionStore {
  read(): Promise<StoredSession | null>;
  write(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

export interface ActiveSession extends StoredSession {
  tokens: SessionTokens;
  expiresAt: number;
}

export class AuthSession {
  private active: ActiveSession | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private accessRequest: Promise<string | null> | null = null;
  constructor(
    private readonly api: Pick<AuthApiClient, 'login' | 'refresh' | 'logout'>,
    private readonly store: SessionStore,
    private readonly now: () => number = Date.now,
  ) {}

  get current(): ActiveSession | null {
    return this.active
      ? { ...this.active, tokens: { ...this.active.tokens } }
      : null;
  }

  login(input: SocialLoginInput): Promise<void> {
    this.accessRequest = null;
    return this.serialize(async () => {
      const issuedAt = this.now();
      const result = await this.api.login(input);
      await this.publish(
        {
          userId: result.user.id,
          provider: input.provider,
          refreshToken: result.refreshToken,
        },
        result,
        issuedAt,
      );
    });
  }

  restore(): Promise<void> {
    this.accessRequest = null;
    return this.serialize(async () => {
      this.active = null;
      const stored = await this.store.read();
      if (stored) await this.rotate(stored);
    });
  }

  getAccessToken(): Promise<string | null> {
    if (this.accessRequest) return this.accessRequest;
    const pending = this.serialize(async () => {
      if (!this.active) return null;
      if (this.active.expiresAt - this.now() <= 30000)
        await this.rotate(this.active);
      return this.active?.tokens.accessToken ?? null;
    });
    this.accessRequest = pending;
    void pending.then(
      () => {
        if (this.accessRequest === pending) this.accessRequest = null;
      },
      () => {
        if (this.accessRequest === pending) this.accessRequest = null;
      },
    );
    return pending;
  }

  logout(): Promise<void> {
    this.accessRequest = null;
    return this.serialize(async () => {
      const active = this.active;
      this.active = null;
      let stored: StoredSession | null = active;
      try {
        stored = active ?? (await this.store.read());
      } finally {
        try {
          await this.store.clear();
        } finally {
          if (stored) await this.api.logout(stored.refreshToken);
        }
      }
    });
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(operation, operation);
    this.queue = pending.catch(() => undefined);
    return pending;
  }

  private async rotate(stored: StoredSession): Promise<void> {
    try {
      const issuedAt = this.now();
      const tokens = await this.api.refresh(stored.refreshToken);
      await this.publish(
        {
          userId: stored.userId,
          provider: stored.provider,
          refreshToken: tokens.refreshToken,
        },
        tokens,
        issuedAt,
      );
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        this.active = null;
        await this.store.clear();
      }
      throw error;
    }
  }

  private async publish(
    stored: StoredSession,
    tokens: SessionTokens,
    issuedAt: number,
  ): Promise<void> {
    try {
      await this.store.write(stored);
    } catch {
      this.active = null;
      await Promise.allSettled([
        this.store.clear(),
        this.api.logout(tokens.refreshToken),
      ]);
      throw new Error('인증 정보를 저장할 수 없습니다.');
    }
    this.active = {
      ...stored,
      tokens,
      expiresAt: issuedAt + tokens.expiresIn * 1000,
    };
  }
}
