import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
// import { PinoLogger } from 'nestjs-pino';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true })
  // app.useGlobalFilters(new HttpExceptionFilter())
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
