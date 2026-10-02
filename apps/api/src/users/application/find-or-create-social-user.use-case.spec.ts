import { describe, expect, vi } from 'vitest';
import { FindOrCreateSocialUserUseCase } from '@users/application/find-or-create-social-user.use-case.js';
import { SocialAccountAlreadyExistsError } from '@users/domain/errors/social-account-already-exists.error.js';

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

  it('생성 중 소셜 계정이 중복되면 다시 조회한 회원을 반환한다.', async () => {
    const key = {
      provider: 'google' as const,
      subject: 'google-user-123',
    };

    const existingUser = { id: 'user-created-by-another-request' };

    const repository = {
      findBySocialAccount: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingUser),
      createWithSocialAccount: vi
        .fn()
        .mockRejectedValue(new SocialAccountAlreadyExistsError()),
    };

    const useCase = new FindOrCreateSocialUserUseCase(repository);

    const result = await useCase.execute(key);

    expect(result).toEqual(existingUser);
    expect(repository.findBySocialAccount).toHaveBeenCalledTimes(2);
    expect(repository.findBySocialAccount).toHaveBeenNthCalledWith(2, key);
    expect(repository.createWithSocialAccount).toHaveBeenCalledExactlyOnceWith(
      key,
    );
  });

  it('소셜 계정 중복 후 재조회해도 회원이 없으면 원래 오류를 전달한다', async () => {
    const key = {
      provider: 'google' as const,
      subject: 'google-user-123',
    };

    const duplicateError = new SocialAccountAlreadyExistsError();

    const repository = {
      findBySocialAccount: vi.fn().mockResolvedValue(null),
      createWithSocialAccount: vi.fn().mockRejectedValue(duplicateError),
    };

    const useCase = new FindOrCreateSocialUserUseCase(repository);

    await expect(useCase.execute(key)).rejects.toBe(duplicateError);

    expect(repository.findBySocialAccount).toHaveBeenCalledTimes(2);
    expect(repository.createWithSocialAccount).toHaveBeenCalledExactlyOnceWith(
      key,
    );
  });

  it('회원 생성 중 일반 오류가 발생하면 재조회 하지 않고 원래 오류를 전달한다.', async () => {
    const key = {
      provider: 'kakao' as const,
      subject: 'kakao-user-123',
    };

    const databaseError = new Error('Database connection lost');

    const repository = {
      findBySocialAccount: vi.fn().mockResolvedValue(null),
      createWithSocialAccount: vi.fn().mockRejectedValue(databaseError),
    };

    const useCase = new FindOrCreateSocialUserUseCase(repository);

    await expect(useCase.execute(key)).rejects.toBe(databaseError);

    expect(repository.findBySocialAccount).toHaveBeenCalledExactlyOnceWith(key);
    expect(repository.createWithSocialAccount).toHaveBeenCalledExactlyOnceWith(
      key,
    );
  });
});
