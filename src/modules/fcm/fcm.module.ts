import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { CustomPushController } from './custom-push.controller';
import { CustomPushService } from './custom-push.service';
import { FcmService } from './fcm.service';
import { PatientDeviceController } from './patient-device.controller';
import { PatientDeviceService } from './patient-device.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [PatientDeviceController, CustomPushController],
  providers: [FcmService, PatientDeviceService, CustomPushService],
  exports: [FcmService, PatientDeviceService],
})
export class FcmModule {}
