import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelSendResult } from '../../common/types/channel-send-result';
import { normalizePhoneForTermii } from '../sms/termii-phone.util';

interface WhatsappGraphError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface WhatsappSendResponse {
  messaging_product?: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string }>;
  error?: WhatsappGraphError;
}

export type SendLabResultsParams = {
  phone: string;
  patientName: string;
  orgName: string;
  date: string;
  time: string;
  pdfUrl: string;
};

type TemplateComponent =
  | {
      type: 'header';
      parameters: Array<{
        type: 'document';
        document: { link: string; filename: string };
      }>;
    }
  | {
      type: 'body';
      parameters: Array<{ type: 'text'; text: string }>;
    };

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private static readonly GRAPH_VERSION = 'v19.0';

  constructor(private readonly config: ConfigService) {}

  /**
   * Template: appointment_scheduled_alert (6 body text variables).
   * Trigger when an appointment is set.
   */
  sendAppointmentScheduled(
    phone: string,
    patientName: string,
    orgName: string,
    date: string,
    time: string,
    contactDept: string,
    contactPhone: string,
  ): Promise<ChannelSendResult> {
    return this.sendTemplate(phone, 'appointment_scheduled_alert', [
      this.bodyComponent([
        patientName,
        orgName,
        date,
        time,
        contactDept,
        contactPhone,
      ]),
    ]);
  }

  /**
   * Template: sample_collected_alert (3 body text variables).
   * Trigger when a lab sample is saved.
   */
  sendSampleCollected(
    phone: string,
    patientName: string,
    testName: string,
    orgName: string,
  ): Promise<ChannelSendResult> {
    return this.sendTemplate(phone, 'sample_collected_alert', [
      this.bodyComponent([patientName, testName, orgName]),
    ]);
  }

  /**
   * Template: payment_confirmation_receipt (3 body text variables).
   * Trigger on successful payment.
   */
  sendPaymentReceipt(
    phone: string,
    clientName: string,
    amount: string | number,
    orgName: string,
  ): Promise<ChannelSendResult> {
    return this.sendTemplate(phone, 'payment_confirmation_receipt', [
      this.bodyComponent([clientName, amount, orgName]),
    ]);
  }

  /**
   * Template: lab_results_ready (document header + 4 body text variables).
   * Trigger when staff clicks "Send to Phone" at the lab.
   *
   * `pdfUrl` must be a publicly reachable HTTPS link for Meta to fetch.
   */
  sendLabResults(params: SendLabResultsParams): Promise<ChannelSendResult> {
    return this.sendTemplate(params.phone, 'lab_results_ready', [
      {
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              link: params.pdfUrl,
              filename: 'Lab_Results.pdf',
            },
          },
        ],
      },
      this.bodyComponent([
        params.patientName,
        params.orgName,
        params.date,
        params.time,
      ]),
    ]);
  }

  /**
   * Template: auth_verification_code (2 body text variables).
   * Trigger when the patient app requests an OTP.
   */
  sendOtpVerification(
    phone: string,
    otpCode: string,
    orgName: string,
  ): Promise<ChannelSendResult> {
    return this.sendTemplate(phone, 'auth_verification_code', [
      this.bodyComponent([otpCode, orgName]),
    ]);
  }

  /** Uppercase + WhatsApp bold markers for every template string variable. */
  private formatTemplateVar(value: string | number): string {
    return `*${String(value).trim().toUpperCase()}*`;
  }

  private bodyComponent(
    values: Array<string | number>,
  ): Extract<TemplateComponent, { type: 'body' }> {
    return {
      type: 'body',
      parameters: values.map((value) => ({
        type: 'text' as const,
        text: this.formatTemplateVar(value),
      })),
    };
  }

  private readCredentials(): {
    accessToken: string;
    phoneNumberId: string;
  } | null {
    const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN')?.trim();
    const phoneNumberId = this.config
      .get<string>('WHATSAPP_PHONE_NUMBER_ID')
      ?.trim();
    if (!accessToken || !phoneNumberId) {
      this.logger.warn(
        'WhatsApp Cloud API not configured (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID); skipping.',
      );
      return null;
    }
    return { accessToken, phoneNumberId };
  }

  private async sendTemplate(
    phone: string,
    templateName: string,
    components: TemplateComponent[],
  ): Promise<ChannelSendResult> {
    if (!phone?.trim()) {
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const credentials = this.readCredentials();
    if (!credentials) {
      return { status: 'SKIPPED_CONFIG' };
    }

    const normalizedTo = normalizePhoneForTermii(phone);
    if (!normalizedTo) {
      this.logger.warn(
        `Could not normalize phone for WhatsApp Cloud API; skipping. template=${templateName} raw=${phone}`,
      );
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const language =
      this.config.get<string>('WHATSAPP_TEMPLATE_LANGUAGE')?.trim() || 'en';
    const url = `https://graph.facebook.com/${WhatsappService.GRAPH_VERSION}/${credentials.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedTo,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            components,
          },
        }),
      });

      const bodyText = await response.text();
      let parsed: WhatsappSendResponse = {};
      try {
        parsed = JSON.parse(bodyText) as WhatsappSendResponse;
      } catch {
        parsed = {};
      }

      if (!response.ok || parsed.error) {
        const errorMessage =
          parsed.error?.message ??
          `WhatsApp Cloud API returned HTTP ${response.status}`;
        this.logger.error(
          `WhatsApp Cloud API failed template=${templateName} status=${response.status} recipient=${normalizedTo} body=${bodyText}`,
        );
        return { status: 'FAILED', errorMessage };
      }

      const providerMessageId = parsed.messages?.[0]?.id;
      this.logger.log(
        `WhatsApp Cloud API sent template=${templateName} recipient=${normalizedTo} messageId=${providerMessageId ?? 'n/a'}`,
      );
      return {
        status: 'SENT',
        provider: 'whatsapp-cloud',
        providerMessageId,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown WhatsApp Cloud API error';
      this.logger.error(
        `WhatsApp Cloud API send error template=${templateName} recipient=${normalizedTo}: ${errorMessage}`,
      );
      return { status: 'FAILED', errorMessage };
    }
  }
}
