import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { HttpExceptionShapeFilter } from './common/filters/http-exception-shape.filter';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  // bufferLogs: true ensures early logs are captured and re-flushed via Pino
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('hbs');

  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({});

  app.useGlobalFilters(
    new HttpExceptionShapeFilter(),
    new PrismaExceptionFilter(),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Helty Hospital API')
    .setDescription('Hospital management system REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
