import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FcmModule } from '../fcm/fcm.module';
import { PatientEmergencyModule } from '../patient-emergency/patient-emergency.module';
import { EmergencyRequestsController } from './emergency-requests.controller';
import { EmergencyRequestsService } from './emergency-requests.service';

@Module({
  imports: [PrismaModule, FcmModule, PatientEmergencyModule],
  controllers: [EmergencyRequestsController],
  providers: [EmergencyRequestsService],
  exports: [EmergencyRequestsService],
})
export class EmergencyRequestsModule {}
