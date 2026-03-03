import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WaitingPatientService } from './waiting-patient.service';
import { WaitingPatientController } from './waiting-patient.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WaitingPatientController],
  providers: [WaitingPatientService],
  exports: [WaitingPatientService],
})
export class WaitingPatientModule {}

