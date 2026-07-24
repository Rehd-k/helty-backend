import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { HttpExceptionShapeFilter } from './common/filters/http-exception-shape.filter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { RedisIoAdapter } from './redis/redis-io.adapter';
import { isUseRedisEnabled } from './redis/redis.module';

async function bootstrap() {
  // bufferLogs: true ensures early logs are captured and re-flushed via Pino
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('hbs');

  const redisUrl = process.env.REDIS_URL?.trim();
  if (isUseRedisEnabled() && redisUrl) {
    const redisIoAdapter = new RedisIoAdapter(app, redisUrl);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  } else {
    app.useWebSocketAdapter(new IoAdapter(app));
  }

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

  // Large .exe uploads over slow links can exceed Node's default 5-minute
  // requestTimeout; that closes the socket and the browser shows "Network error".
  const server = await app.listen(process.env.PORT ?? 4000);
  const uploadTimeoutMs = Number(process.env.HTTP_REQUEST_TIMEOUT_MS) || 0;
  server.setTimeout(uploadTimeoutMs);
  // Node 18+: IncomingMessage requestTimeout defaults to 300_000 ms.
  if (typeof (server as { requestTimeout?: number }).requestTimeout === 'number') {
    (server as { requestTimeout: number }).requestTimeout = uploadTimeoutMs;
  }
  if (typeof (server as { headersTimeout?: number }).headersTimeout === 'number') {
    // Must stay >= requestTimeout when requestTimeout is non-zero.
    (server as { headersTimeout: number }).headersTimeout =
      uploadTimeoutMs === 0 ? 0 : Math.max(uploadTimeoutMs + 60_000, 120_000);
  }
}
bootstrap();
