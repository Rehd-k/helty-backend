import { BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

describe('SmsService (Termii)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns SKIPPED_CONFIG when Termii env vars are missing', async () => {
    const config = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const service = new SmsService(config);
    const result = await service.sendAppointmentSms(
      '+2348000000000',
      'Test message',
    );

    expect(result).toEqual({ status: 'SKIPPED_CONFIG' });
  });

  it('returns SKIPPED_NO_CONTACT when phone is empty', async () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          TERMII_API_KEY: 'key',
          TERMII_BASE_URL: 'https://v3.api.termii.com',
          TERMII_SENDER_ID: 'Helty',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const service = new SmsService(config);
    const result = await service.sendAppointmentSms('', 'Test message');

    expect(result).toEqual({ status: 'SKIPPED_NO_CONTACT' });
  });

  it('skips the provider when outbound messaging is off', async () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          OUTBOUND_MESSAGING_ENABLED: 'false',
          TERMII_API_KEY: 'test-key',
          TERMII_BASE_URL: 'https://v3.api.termii.com',
          TERMII_SENDER_ID: 'Helty',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const fetchMock = jest.spyOn(global, 'fetch');
    const service = new SmsService(config);
    const result = await service.sendAppointmentSms(
      '08030000000',
      'Appointment reminder',
    );

    expect(result).toEqual({ status: 'SKIPPED_CONFIG' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends via Termii API and returns message_id on success', async () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          TERMII_API_KEY: 'test-key',
          TERMII_BASE_URL: 'https://v3.api.termii.com',
          TERMII_SENDER_ID: 'Helty',
          TERMII_CHANNEL: 'dnd',
          TERMII_TYPE: 'plain',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          code: 'ok',
          message_id_str: '3017544054459083819856413',
        }),
    } as Response);

    const service = new SmsService(config);
    const result = await service.sendAppointmentSms(
      '08030000000',
      'Appointment reminder',
    );

    expect(result).toEqual({
      status: 'SENT',
      provider: 'termii',
      providerMessageId: '3017544054459083819856413',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://v4.api.termii.com/api/sms/number/send',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({
      api_key: 'test-key',
      from: 'Helty',
      sms: 'Appointment reminder',
      type: 'plain',
      channel: 'dnd',
      to: '2348030000000',
    });
  });

  it('defaults sender to N-Alert and base URL when they are unset', async () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          TERMII_API_KEY: 'test-key',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ code: 'ok', message_id: 'abc' }),
    } as Response);

    const service = new SmsService(config);
    const result = await service.sendAppointmentSms(
      '08012345678',
      'Appointment reminder',
    );

    expect(result).toEqual({
      status: 'SENT',
      provider: 'termii',
      providerMessageId: 'abc',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://v4.api.termii.com/api/sms/number/send',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual({
      api_key: 'test-key',
      to: '2348012345678',
      from: 'N-Alert',
      sms: 'Appointment reminder',
      type: 'plain',
      channel: 'dnd',
    });
  });

  it('throws BadGatewayException on OTP provider failure without logging the code', async () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          TERMII_API_KEY: 'test-key',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          code: 'error',
          message: 'Sender ID not approved',
        }),
    } as Response);

    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const service = new SmsService(config);
    const otp = '847291';

    await expect(
      service.sendOtpSms(
        '08012345678',
        `Your Helty Hospital verification code is ${otp}. Valid for 10 minutes. Do not share this code.`,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls
      .map((call) => String(call[0]))
      .join('\n');
    expect(logged).toContain('status=400');
    expect(logged).toContain('2348012345678');
    expect(logged).toContain('Sender ID not approved');
    expect(logged).not.toContain(otp);
  });
});
