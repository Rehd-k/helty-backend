import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '../sms/sms.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import {
  OtpChannel,
  OtpDeliveryMode,
  deliveryMode,
  parseOtpDelivery,
} from './patient-otp-delivery';

@Injectable()
export class PatientOtpDeliveryService {
  constructor(
    private readonly config: ConfigService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsappService,
  ) {}

  channels(): Set<OtpChannel> {
    return parseOtpDelivery(this.config.get<string>('PATIENT_OTP_DELIVERY'));
  }

  mode(): OtpDeliveryMode {
    return deliveryMode(this.channels());
  }

  private hospitalName(): string {
    return this.config.get<string>('HOSPITAL_NAME')?.trim() || 'HELTY';
  }

  /** Staff desk is the default. SMS and WhatsApp run only when listed. */
  async deliver(phone: string, code: string): Promise<OtpDeliveryMode> {
    const channels = this.channels();
    const appName = this.hospitalName();
    const message = `Your ${appName} verification code is ${code}. Valid for 10 minutes. Do not share this code.`;
    let smsError: unknown;
    if (channels.has('sms')) {
      try {
        await this.sms.sendOtpSms(phone, message);
      } catch (err) {
        smsError = err;
      }
    }
    if (channels.has('whatsapp')) {
      await this.whatsapp.sendOtpVerification(phone, code, appName);
    }
    if (smsError) {
      throw smsError;
    }
    return deliveryMode(channels);
  }
}
