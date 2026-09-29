export type SocialAccountKey = {
  provider: 'google' | 'kakao' | 'naver';
  subject: string;
};

export type User = {
  id: string;
};

export interface SocialUserRepository {
  findBySocialAccount(key: SocialAccountKey): Promise<User | null>;
  createWithSocialAccount(key: SocialAccountKey): Promise<User>;
}

export class FindOrCreateSocialUserUseCase {
  constructor(private readonly repository: SocialUserRepository) {}

  async execute(_key: SocialAccountKey): Promise<User> {
    throw new Error('Not implemented');
  }
}
