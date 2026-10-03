import { createHash } from 'node:crypto';
import {
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import {
  AUTH_RATE_LIMIT_REPOSITORY,
  type AuthRateLimitRepository,
} from '../../application/ports/auth-rate-limit.repository.js';
import { normalizeClientIp } from '../../infrastructure/rate-limit/client-ip.js';
import type { AuthenticatedRequest } from './access-token.guard.js';
import {
  AUTH_RATE_LIMIT_GROUP,
  authRateLimits,
  type AuthRateLimitGroup,
} from './auth-rate-limit.js';

async function enforce(
  repository: AuthRateLimitRepository,
  context: ExecutionContext,
  group: AuthRateLimitGroup,
  kind: 'ip' | 'member',
  identity: string,
) {
  const key = createHash('sha256')
    .update(JSON.stringify([group, kind, identity]))
    .digest('hex');
  const result = await repository.consume(key, authRateLimits[group]);
  if (!result.allowed) {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', String(result.retryAfter));
    throw new HttpException(
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      },
      429,
    );
  }
  return true;
}

@Injectable()
export class AuthIpRateLimitGuard implements CanActivate {
  constructor(
    @Inject(AUTH_RATE_LIMIT_REPOSITORY)
    private readonly repository: AuthRateLimitRepository,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const group = this.reflector.getAllAndOverride<AuthRateLimitGroup>(
      AUTH_RATE_LIMIT_GROUP,
      [context.getHandler(), context.getClass()],
    );
    if (!group) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const ip = normalizeClientIp(
      request.ip ?? request.socket.remoteAddress ?? '',
    );
    return enforce(this.repository, context, group, 'ip', ip);
  }
}

@Injectable()
export class AuthMemberRateLimitGuard implements CanActivate {
  constructor(
    @Inject(AUTH_RATE_LIMIT_REPOSITORY)
    private readonly repository: AuthRateLimitRepository,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest<AuthenticatedRequest>()
      .user?.userId;
    if (!userId)
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: '인증이 필요합니다.',
      });
    return enforce(this.repository, context, 'link', 'member', userId);
  }
}
