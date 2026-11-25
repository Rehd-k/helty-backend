import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientFamilyModule } from '../patient-family/patient-family.module';
import { PatientBillingController } from './patient-billing.controller';
import { PatientBillingService } from './patient-billing.service';

@Module({
  imports: [PrismaModule, PatientFamilyModule],
  controllers: [PatientBillingController],
  providers: [PatientBillingService],
})
export class PatientBillingModule {}
