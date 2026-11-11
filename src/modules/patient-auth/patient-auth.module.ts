import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { SmsModule } from '../sms/sms.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PatientAuthController } from './patient-auth.controller';
import { PatientOtpDeliveryService } from './patient-otp-delivery.service';
import { PatientAuthService } from './patient-auth.service';

@Module({
  imports: [AuthModule, PrismaModule, SmsModule, WhatsappModule, ChatModule],
  controllers: [PatientAuthController],
  providers: [PatientAuthService, PatientOtpDeliveryService],
  exports: [PatientAuthService],
})
export class PatientAuthModule {}
