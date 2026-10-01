import { BadRequestException, type PipeTransform } from '@nestjs/common';

export type SocialLoginRequest = { provider: 'google'; credential: string };

export class SocialLoginRequestPipe implements PipeTransform<
  unknown,
  SocialLoginRequest
> {
  transform(value: unknown): SocialLoginRequest {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(['요청 본문은 객체여야 합니다.']);
    }

    const body = value as Record<string, unknown>;
    const errors: string[] = [];
    if (body.provider !== 'google')
      errors.push('provider는 google이어야 합니다.');
    if (typeof body.credential !== 'string' || !body.credential.trim()) {
      errors.push('credential은 비어 있지 않은 문자열이어야 합니다.');
    }
    if (
      Object.keys(body).some(
        (key) => key !== 'provider' && key !== 'credential',
      )
    ) {
      errors.push('허용하지 않은 필드가 포함되어 있습니다.');
    }
    if (errors.length) throw new BadRequestException(errors);

    return { provider: 'google', credential: body.credential as string };
  }
}
