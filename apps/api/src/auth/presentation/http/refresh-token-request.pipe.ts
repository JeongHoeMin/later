import { BadRequestException, type PipeTransform } from '@nestjs/common';
export type RefreshTokenRequest = { refreshToken: string };
export class RefreshTokenRequestPipe implements PipeTransform<
  unknown,
  RefreshTokenRequest
> {
  transform(value: unknown): RefreshTokenRequest {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException(['요청 본문은 객체여야 합니다.']);
    const body = value as Record<string, unknown>;
    if (Object.keys(body).some((key) => key !== 'refreshToken'))
      throw new BadRequestException([
        '허용하지 않은 필드가 포함되어 있습니다.',
      ]);
    if (typeof body.refreshToken !== 'string' || !body.refreshToken.trim())
      throw new BadRequestException([
        'refreshToken은 비어 있지 않은 문자열이어야 합니다.',
      ]);
    return { refreshToken: body.refreshToken };
  }
}
