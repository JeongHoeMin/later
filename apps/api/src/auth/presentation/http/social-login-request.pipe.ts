import { BadRequestException, type PipeTransform } from '@nestjs/common';

export type SocialLoginRequest =
  | { provider: 'google' | 'kakao'; credential: string }
  | { provider: 'naver'; credential: string; state: string };

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
    if (
      body.provider !== 'google' &&
      body.provider !== 'kakao' &&
      body.provider !== 'naver'
    )
      errors.push('provider는 google, kakao 또는 naver여야 합니다.');
    if (typeof body.credential !== 'string' || !body.credential.trim()) {
      errors.push('credential은 비어 있지 않은 문자열이어야 합니다.');
    }
    if (
      Object.keys(body).some(
        (key) =>
          key !== 'provider' &&
          key !== 'credential' &&
          !(body.provider === 'naver' && key === 'state'),
      )
    ) {
      errors.push('허용하지 않은 필드가 포함되어 있습니다.');
    }
    if (
      body.provider === 'naver' &&
      (typeof body.state !== 'string' ||
        !body.state.trim() ||
        /\s/.test(body.state))
    ) {
      errors.push('네이버 state는 공백 없는 인증 요청의 문자열이어야 합니다.');
    }
    if (errors.length) throw new BadRequestException(errors);

    if (body.provider === 'naver')
      return {
        provider: 'naver',
        credential: body.credential as string,
        state: body.state as string,
      };
    return {
      provider: body.provider as 'google' | 'kakao',
      credential: body.credential as string,
    };
  }
}
