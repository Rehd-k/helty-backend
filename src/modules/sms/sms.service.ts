import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelSendResult } from '../../common/types/channel-send-result';
import { normalizePhoneForTermii } from './termii-phone.util';

/** Termii send SMS success payload (https://developers.termii.com/messaging-api). */
interface TermiiSendResponse {
  code?: string;
  message?: string;
  message_id?: string;
  message_id_str?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Sends a plain SMS via Termii.
   * Skips when Termii env is missing or the phone cannot be normalized.
   */
  sendSms(to: string, message: string): Promise<ChannelSendResult> {
    return this.sendAppointmentSms(to, message);
  }

  /**
   * Sends a WhatsApp message via Termii on the same /api/sms/send endpoint.
   * Skips when Termii env or TERMII_WHATSAPP_SENDER_ID is missing.
   */
  sendWhatsApp(to: string, message: string): Promise<ChannelSendResult> {
    return this.sendTermii(to, message, {
      channel: 'whatsapp',
      senderEnv: 'TERMII_WHATSAPP_SENDER_ID',
      label: 'WhatsApp',
    });
  }

  /**
   * Sends SMS via Termii (POST {TERMII_BASE_URL}/api/sms/send).
   * Skips when Termii env is missing or phone cannot be normalized.
   */
  sendAppointmentSms(
    to: string,
    message: string,
  ): Promise<ChannelSendResult> {
    return this.sendTermii(to, message, {
      channel: this.config.get<string>('TERMII_CHANNEL')?.trim() || 'dnd',
      senderEnv: 'TERMII_SENDER_ID',
      label: 'SMS',
    });
  }

  private async sendTermii(
    to: string,
    message: string,
    options: { channel: string; senderEnv: string; label: string },
  ): Promise<ChannelSendResult> {
    if (!to?.trim()) {
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const apiKey = this.config.get<string>('TERMII_API_KEY')?.trim();
    const baseUrl = this.config.get<string>('TERMII_BASE_URL')?.trim();
    const senderId = this.config.get<string>(options.senderEnv)?.trim();
    const type = this.config.get<string>('TERMII_TYPE')?.trim() || 'plain';
    if (!apiKey || !baseUrl || !senderId) {
      this.logger.warn(
        `Termii ${options.label} not configured (TERMII_API_KEY, TERMII_BASE_URL, ${options.senderEnv}); skipping.`,
      );
      return { status: 'SKIPPED_CONFIG' };
    }

    const normalizedTo = normalizePhoneForTermii(to);
    if (!normalizedTo) {
      this.logger.warn(
        `Could not normalize phone for Termii; skipping ${options.label}. raw=${to}`,
      );
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/sms/send`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          to: normalizedTo,
          from: senderId,
          sms: message,
          type,
          channel: options.channel,
        }),
      });

      const bodyText = await response.text();
      let parsed: TermiiSendResponse = {};
      try {
        parsed = JSON.parse(bodyText) as TermiiSendResponse;
      } catch {
        parsed = {};
      }

      if (!response.ok) {
        this.logger.error(
          `Termii ${options.label} failed status=${response.status} recipient=${normalizedTo} body=${bodyText}`,
        );
        return {
          status: 'FAILED',
          errorMessage:
            parsed.message ?? `Termii returned HTTP ${response.status}`,
        };
      }

      if (parsed.code && parsed.code !== 'ok') {
        this.logger.error(
          `Termii ${options.label} error code=${parsed.code} recipient=${normalizedTo} body=${bodyText}`,
        );
        return {
          status: 'FAILED',
          errorMessage: parsed.message ?? `Termii code: ${parsed.code}`,
        };
      }

      const providerMessageId =
        parsed.message_id_str ?? parsed.message_id ?? undefined;

      this.logger.log(
        `Termii ${options.label} sent recipient=${normalizedTo} messageId=${providerMessageId ?? 'n/a'}`,
      );
      return {
        status: 'SENT',
        provider: 'termii',
        providerMessageId,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown Termii send error';
      this.logger.error(
        `Termii ${options.label} send error recipient=${normalizedTo}: ${errorMessage}`,
      );
      return { status: 'FAILED', errorMessage };
    }
  }
}
