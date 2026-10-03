import {
  USER_ACCOUNT_REPOSITORY,
  type UserAccountRepository,
} from '@users/application/ports/user-account.repository.js';
import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
  type AuthenticatedUser,
} from '@auth/application/ports/access-token.js';
import { InvalidAccessTokenError } from '@auth/domain/errors/invalid-access-token.error.js';

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly verifier: AccessTokenVerifier,
    @Inject(USER_ACCOUNT_REPOSITORY)
    private readonly users: Pick<UserAccountRepository, 'exists'>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const header = request.headers.authorization;
    const token =
      typeof header === 'string'
        ? /^Bearer +([^\s,]+)$/i.exec(header)?.[1]
        : undefined;
    if (!token) {
      response.setHeader('WWW-Authenticate', 'Bearer');
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: '인증이 필요합니다.',
      });
    }

    try {
      const user = await this.verifier.verify(token);
      if (!(await this.users.exists(user.userId)))
        throw new InvalidAccessTokenError();
      request.user = user;
      return true;
    } catch (error: unknown) {
      if (error instanceof InvalidAccessTokenError) {
        response.setHeader('WWW-Authenticate', 'Bearer');
        throw new UnauthorizedException({
          code: 'INVALID_ACCESS_TOKEN',
          message: '유효하지 않은 Access Token입니다.',
        });
      }
      throw error;
    }
  }
}
