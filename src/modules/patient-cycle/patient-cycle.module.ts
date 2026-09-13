import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientCycleController } from './patient-cycle.controller';
import { PatientCycleService } from './patient-cycle.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientCycleController],
  providers: [PatientCycleService],
  exports: [PatientCycleService],
})
export class PatientCycleModule {}
