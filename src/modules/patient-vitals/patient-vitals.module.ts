import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientVitalsService } from './patient-vitals.service';
import { PatientVitalsController } from './patient-vitals.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PatientVitalsController],
  providers: [PatientVitalsService],
  exports: [PatientVitalsService],
})
export class PatientVitalsModule {}
