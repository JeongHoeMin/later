import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = performance.now();
    const metadata = {
      requestId: randomUUID(),
      method: request.method,
      controller: context.getClass().name,
      handler: context.getHandler().name,
    };
    response.setHeader('X-Request-Id', metadata.requestId);
    this.logger.log({ event: 'request.started', ...metadata });
    let ended = false;
    const terminal = (aborted: boolean) => {
      if (ended) return;
      ended = true;
      const statusCode = aborted ? undefined : response.statusCode;
      const record = {
        event:
          aborted || response.statusCode >= 400
            ? 'request.failed'
            : 'request.succeeded',
        ...metadata,
        statusCode,
        durationMs: Math.round((performance.now() - started) * 1000) / 1000,
        ...(aborted ? { reason: 'connection_closed' } : {}),
      };
      if (!aborted && response.statusCode >= 500) this.logger.error(record);
      else if (aborted || response.statusCode >= 400) this.logger.warn(record);
      else this.logger.log(record);
    };
    response.once('finish', () => terminal(false));
    response.once('close', () => terminal(!response.writableFinished));
    return next.handle();
  }
}
