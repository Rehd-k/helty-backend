import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';
import { AppointmentNotificationService } from './notification/appointment-notification.service';
import { AppointmentReminderScheduler } from './notification/appointment-reminder.scheduler';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    MailModule,
    SmsModule,
  ],
  controllers: [AppointmentController],
  providers: [
    AppointmentService,
    AppointmentNotificationService,
    AppointmentReminderScheduler,
  ],
  exports: [AppointmentService, AppointmentNotificationService],
})
export class AppointmentModule {}
