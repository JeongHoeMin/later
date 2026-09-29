import { describe, expect, vi } from 'vitest';
import { FindOrCreateSocialUserUseCase } from './find-or-create-social-user.use-case.js';

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
});
