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
      'https://v3.api.termii.com/api/sms/send',
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
});
