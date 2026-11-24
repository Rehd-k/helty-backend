import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { logException } from './http-exception.filter';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    logException(this.logger, host, exception, 400);

    // map common errors
    let message = exception.message;
    if (exception.code === 'P2002') {
      // unique constraint failed
      message = 'Duplicate value violates unique constraint';
    }
    response.status(400).json({
      statusCode: 400,
      error: 'Bad Request',
      message,
    });
  }
}
