import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FcmModule } from '../fcm/fcm.module';
import { PatientAuthModule } from '../patient-auth/patient-auth.module';
import { FrontdeskController } from './frontdesk.controller';
import { FrontdeskFamilyService } from './frontdesk-family.service';
import { FrontdeskPatientAccessController } from './frontdesk-patient-access.controller';
import { FrontdeskPatientDeviceService } from './frontdesk-patient-device.service';
import { FrontdeskService } from './frontdesk.service';

@Module({
  imports: [PrismaModule, FcmModule, PatientAuthModule],
  controllers: [FrontdeskController, FrontdeskPatientAccessController],
  providers: [
    FrontdeskService,
    FrontdeskPatientDeviceService,
    FrontdeskFamilyService,
  ],
  exports: [
    FrontdeskService,
    FrontdeskPatientDeviceService,
    FrontdeskFamilyService,
  ],
})
export class FrontdeskModule {}
