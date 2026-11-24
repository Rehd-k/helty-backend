import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService OTP template', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the raw OTP in the body and the URL button', async () => {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          WHATSAPP_ACCESS_TOKEN: 'token',
          WHATSAPP_PHONE_NUMBER_ID: '123',
          WHATSAPP_TEMPLATE_LANGUAGE: 'en',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messages: [{ id: 'wamid.1' }] }),
    } as Response);

    const service = new WhatsappService(config);
    const result = await service.sendOtpVerification(
      '08120766716',
      '482913',
      'HELTY',
    );

    expect(result).toEqual({
      status: 'SENT',
      provider: 'whatsapp-cloud',
      providerMessageId: 'wamid.1',
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as {
      template: {
        name: string;
        components: Array<{
          type: string;
          sub_type?: string;
          index?: string;
          parameters: Array<{ type: string; text: string }>;
        }>;
      };
    };

    expect(body.template.name).toBe('auth_verification_code');
    expect(body.template.components).toEqual([
      {
        type: 'body',
        parameters: [{ type: 'text', text: '482913' }],
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: '482913' }],
      },
    ]);
  });
});
