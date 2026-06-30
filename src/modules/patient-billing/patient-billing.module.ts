import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientBillingController } from './patient-billing.controller';
import { PatientBillingService } from './patient-billing.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientBillingController],
  providers: [PatientBillingService],
})
export class PatientBillingModule {}
