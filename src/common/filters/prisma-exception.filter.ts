import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

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
