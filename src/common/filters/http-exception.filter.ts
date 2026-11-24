import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type HttpResponse = Response;

export function exceptionMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const body = exception.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (Array.isArray(message)) return message.map(String).join(', ');
      if (typeof message === 'string') return message;
    }
    return exception.message;
  }

  if (exception instanceof Error) {
    const code = (exception as Error & { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return `${exception.message} [${code}]`;
    }
    return exception.message;
  }

  return String(exception);
}

export function logException(
  logger: Logger,
  host: ArgumentsHost,
  exception: unknown,
  status: number,
): void {
  const request = host.switchToHttp().getRequest<Request | undefined>();
  const method = request?.method ?? host.getType();
  const path = request?.originalUrl || request?.url || '-';
  const line = `${method} ${status} ${path}  ${exceptionMessage(exception)}`;

  if (status >= 500 && exception instanceof Error) {
    logger.error(line, exception.stack);
  } else if (status >= 500) {
    logger.error(line);
  } else {
    logger.warn(line);
  }
}

function statusErrorLabel(status: number): string {
  const name = HttpStatus[status];
  if (typeof name !== 'string') return 'Internal Server Error';
  return name
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function exceptionBody(exception: unknown, status: number) {
  let message = 'Internal server error';
  let error = 'Internal Server Error';

  if (exception instanceof HttpException) {
    error = statusErrorLabel(status);
    const response = exception.getResponse();
    if (typeof response === 'string') {
      message = response;
    } else if (response && typeof response === 'object') {
      const body = response as Record<string, unknown>;
      if (typeof body.error === 'string' && body.error.length > 0) {
        error = body.error;
      }
      if (typeof body.message === 'string') {
        message = body.message;
      } else if (Array.isArray(body.message)) {
        message = body.message.map(String).join(', ');
      } else if (exception.message) {
        message = exception.message;
      }
    } else if (exception.message) {
      message = exception.message;
    }
  } else if (exception instanceof Error && exception.message) {
    message = exception.message;
  } else if (!(exception instanceof Error) && exception != null) {
    message = String(exception);
  }

  return {
    statusCode: status,
    error,
    message,
    timestamp: new Date().toISOString(),
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    logException(this.logger, host, exception, status);

    if (host.getType() !== 'http') return;

    const response = host.switchToHttp().getResponse<HttpResponse>();
    response.status(status).json(exceptionBody(exception, status));
  }
}
