import { describe, expect, vi } from 'vitest';
import { FindOrCreateSocialUserUseCase } from '@users/application/find-or-create-social-user.use-case.js';

describe('FindOrCreateSocialUserUseCase', () => {
  it('연결된 회원이 있으면 새로 생성하지 않고 기존 회원을 반환한다.', async () => {
    const existingUser = { id: 'user-1' };
    const repository = {
      findBySocialAccount: vi.fn().mockResolvedValue(existingUser),
      createWithSocialAccount: vi.fn(),
    };

    const useCase = new FindOrCreateSocialUserUseCase(repository);

    const result = await useCase.execute({
      provider: 'google',
      subject: 'google-user-123',
    });

    expect(result).toEqual(existingUser);
    expect(repository.findBySocialAccount).toHaveBeenCalledWith({
      provider: 'google',
      subject: 'google-user-123',
    });
    expect(repository.createWithSocialAccount).not.toHaveBeenCalled();
  });

  it('연결된 회원이 없으면 소셜 계정과 함께 회원을 생성하고 반환한다', async () => {
    const key = {
      provider: 'google' as const,
      subject: 'new-google-user',
    };

    const createdUser = { id: 'user-2' };

    const repository = {
      findBySocialAccount: vi.fn().mockResolvedValue(null),
      createWithSocialAccount: vi.fn().mockResolvedValue(createdUser),
    };

    const useCase = new FindOrCreateSocialUserUseCase(repository);

    const result = await useCase.execute(key);

    expect(result).toEqual(createdUser);
    expect(repository.findBySocialAccount).toHaveBeenCalledWith(key);
    expect(repository.createWithSocialAccount).toHaveBeenCalledExactlyOnceWith(
      key,
    );
  });
});
