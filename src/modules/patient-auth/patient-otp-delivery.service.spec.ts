import { ConfigService } from '@nestjs/config';
import { SmsService } from '../sms/sms.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { deliveryMode, parseOtpDelivery } from './patient-otp-delivery';
import { PatientOtpDeliveryService } from './patient-otp-delivery.service';

describe('parseOtpDelivery', () => {
  it('defaults to the staff desk', () => {
    expect(parseOtpDelivery(undefined)).toEqual(new Set(['staff']));
    expect(parseOtpDelivery('')).toEqual(new Set(['staff']));
    expect(parseOtpDelivery('nope')).toEqual(new Set(['staff']));
  });

  it('reads a comma list', () => {
    expect(parseOtpDelivery('sms, whatsapp')).toEqual(
      new Set(['sms', 'whatsapp']),
    );
    expect(deliveryMode(parseOtpDelivery('sms,whatsapp'))).toBe('phone');
    expect(deliveryMode(parseOtpDelivery('staff,sms'))).toBe('both');
  });
});

describe('PatientOtpDeliveryService', () => {
  const sms = {
    sendSms: jest.fn().mockResolvedValue({ status: 'SENT' }),
    sendWhatsApp: jest.fn().mockResolvedValue({ status: 'SENT' }),
  } as unknown as SmsService;

  const whatsapp = {
    sendOtpVerification: jest.fn().mockResolvedValue({ status: 'SENT' }),
  } as unknown as WhatsappService;

  function serviceFor(raw: string | undefined) {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'PATIENT_OTP_DELIVERY') return raw;
        if (key === 'HOSPITAL_NAME') return 'IBOM SPECIALIST HOSPITAL';
        return undefined;
      }),
    } as unknown as ConfigService;
    return new PatientOtpDeliveryService(config, sms, whatsapp);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call Termii when only staff can see the code', async () => {
    const mode = await serviceFor('staff').deliver('08030000000', '123456');
    expect(mode).toBe('staff');
    expect(sms.sendSms).not.toHaveBeenCalled();
    expect(whatsapp.sendOtpVerification).not.toHaveBeenCalled();
  });

  it('sends the same code by SMS and WhatsApp when both are enabled', async () => {
    const mode = await serviceFor('sms,whatsapp').deliver('08030000000', '123456');
    expect(mode).toBe('phone');
    expect(sms.sendSms).toHaveBeenCalledWith(
      '08030000000',
      expect.stringContaining('123456'),
    );
    expect(whatsapp.sendOtpVerification).toHaveBeenCalledWith(
      '08030000000',
      '123456',
      'IBOM SPECIALIST HOSPITAL',
    );
    expect(sms.sendWhatsApp).not.toHaveBeenCalled();
  });
});
