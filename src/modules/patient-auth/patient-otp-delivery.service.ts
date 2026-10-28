import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '../sms/sms.service';
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
  ) {}

  channels(): Set<OtpChannel> {
    return parseOtpDelivery(this.config.get<string>('PATIENT_OTP_DELIVERY'));
  }

  mode(): OtpDeliveryMode {
    return deliveryMode(this.channels());
  }

  /** Staff desk is the default. SMS and WhatsApp run only when listed. */
  async deliver(phone: string, code: string): Promise<OtpDeliveryMode> {
    const channels = this.channels();
    const message = `Your IMSH login code is ${code}. It expires in 10 minutes.`;
    if (channels.has('sms')) {
      await this.sms.sendSms(phone, message);
    }
    if (channels.has('whatsapp')) {
      await this.sms.sendWhatsApp(phone, message);
    }
    return deliveryMode(channels);
  }
}
