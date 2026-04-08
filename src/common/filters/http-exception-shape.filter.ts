import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionShapeFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'code' in payload &&
      typeof (payload as Record<string, unknown>).code === 'string'
    ) {
      const p = payload as Record<string, unknown>;
      const msg = p.message;
      const message =
        typeof msg === 'string'
          ? msg
          : Array.isArray(msg)
            ? msg.join(', ')
            : String(msg ?? exception.message);
      return res.status(status).json({
        statusCode: status,
        error:
          typeof p.error === 'string' ? p.error : HttpStatus[status] ?? 'Error',
        code: p.code,
        message,
      });
    }

    if (typeof payload === 'string') {
      return res.status(status).json({
        statusCode: status,
        error: HttpStatus[status] ?? 'Error',
        message: payload,
      });
    }

    const body = payload as Record<string, unknown>;
    return res.status(status).json({
      statusCode: status,
      ...(typeof body === 'object' && body !== null ? body : {}),
    });
  }
}
