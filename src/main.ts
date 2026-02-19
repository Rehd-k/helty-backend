import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  // disable built‑in console logger so only pino handles output
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Hospital Management System - Medical Records API')
    .setDescription(
      'Complete hospital management system backend for medical records department',
    )
    .setVersion('1.0')
    .addTag('Patient', 'Patient management endpoints')
    .addTag('Appointment', 'Appointment scheduling endpoints')
    .addTag('Admission', 'Patient admission endpoints')
    .addTag('Payment', 'Payment tracking endpoints')
    .addTag('Doctor Report', 'Doctor report management endpoints')
    .addTag('Lab Report', 'Laboratory report endpoints')
    .addTag('Radiology Report', 'Radiology imaging endpoints')
    .addTag('Prescription', 'Medication prescription endpoints')
    .addTag('Service', 'Hospital service management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Hospital Management System is running on port ${port}`);
  console.log(`API Documentation available at http://localhost:${port}/api`);
}
bootstrap();
