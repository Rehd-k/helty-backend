import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HealthContentController } from './health-content.controller';
import { HealthContentImageController } from './health-content-image.controller';
import { HealthContentService } from './health-content.service';
import { PatientHealthContentController } from './patient-health-content.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    HealthContentController,
    HealthContentImageController,
    PatientHealthContentController,
  ],
  providers: [HealthContentService],
  exports: [HealthContentService],
})
export class HealthContentModule {}
