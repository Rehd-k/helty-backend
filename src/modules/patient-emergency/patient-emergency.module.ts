import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmergencyRequestStorageService } from './emergency-request-storage.service';
import { PatientEmergencyController } from './patient-emergency.controller';
import { PublicEmergencyController } from './public-emergency.controller';
import { PatientEmergencyService } from './patient-emergency.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientEmergencyController, PublicEmergencyController],
  providers: [PatientEmergencyService, EmergencyRequestStorageService],
  exports: [EmergencyRequestStorageService, PatientEmergencyService],
})
export class PatientEmergencyModule {}
