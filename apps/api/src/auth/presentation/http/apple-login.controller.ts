import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
} from '@nestjs/common';
import { StartAppleLoginUseCase } from '@auth/application/start-apple-login.use-case.js';

@Controller('auth/social/apple')
export class AppleLoginController {
  constructor(
    @Inject(StartAppleLoginUseCase)
    private readonly startUseCase: StartAppleLoginUseCase,
  ) {}

  @Post('start')
  start(@Body() body: unknown) {
    if (
      body !== undefined &&
      (typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length > 0)
    )
      throw new BadRequestException([
        'Apple 로그인 시작 요청에는 입력 필드가 없습니다.',
      ]);
    return this.startUseCase.execute();
  }
}
