import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { ApiErrorResponse } from './api-error-response.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.toResponse(exception, status);
    const response = host.switchToHttp().getResponse<unknown>();
    this.adapterHost.httpAdapter.reply(response, body, status);
  }

  private toResponse(exception: unknown, status: number): ApiErrorResponse {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : exception,
      );
      return {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서버 오류가 발생했습니다.',
        },
      };
    }

    const payload = (exception as HttpException).getResponse();
    const code =
      typeof payload === 'object' &&
      'code' in payload &&
      typeof payload.code === 'string' &&
      payload.code.trim()
        ? payload.code
        : (HttpStatus[status] ?? 'HTTP_ERROR');
    const message =
      typeof payload === 'string'
        ? payload
        : 'message' in payload
          ? payload.message
          : undefined;
    if (Array.isArray(message)) {
      return {
        error: {
          code,
          message: '요청 값이 올바르지 않습니다.',
          details: message.filter(
            (item): item is string => typeof item === 'string',
          ),
        },
      };
    }
    return {
      error: {
        code,
        message:
          typeof message === 'string' ? message : '요청을 처리할 수 없습니다.',
      },
    };
  }
}
