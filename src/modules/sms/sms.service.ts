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

  private termiiConfig(): {
    apiKey: string;
    baseUrl: string;
    senderId: string;
    channel: string;
    type: string;
  } | null {
    const apiKey = this.config.get<string>('TERMII_API_KEY')?.trim();
    const baseUrl = this.config.get<string>('TERMII_BASE_URL')?.trim();
    const senderId = this.config.get<string>('TERMII_SENDER_ID')?.trim();
    if (!apiKey || !baseUrl || !senderId) {
      return null;
    }
    const channel =
      this.config.get<string>('TERMII_CHANNEL')?.trim() || 'dnd';
    const type = this.config.get<string>('TERMII_TYPE')?.trim() || 'plain';
    return { apiKey, baseUrl, senderId, channel, type };
  }

  /**
   * Sends SMS via Termii (POST {TERMII_BASE_URL}/api/sms/send).
   * Skips when Termii env is missing or phone cannot be normalized.
   */
  async sendAppointmentSms(
    to: string,
    message: string,
  ): Promise<ChannelSendResult> {
    if (!to?.trim()) {
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const cfg = this.termiiConfig();
    if (!cfg) {
      this.logger.warn(
        'Termii not configured (TERMII_API_KEY, TERMII_BASE_URL, TERMII_SENDER_ID); skipping SMS.',
      );
      return { status: 'SKIPPED_CONFIG' };
    }

    const normalizedTo = normalizePhoneForTermii(to);
    if (!normalizedTo) {
      this.logger.warn(
        `Could not normalize phone for Termii; skipping SMS. raw=${to}`,
      );
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const url = `${cfg.baseUrl.replace(/\/$/, '')}/api/sms/send`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: cfg.apiKey,
          to: normalizedTo,
          from: cfg.senderId,
          sms: message,
          type: cfg.type,
          channel: cfg.channel,
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
          `Termii SMS failed status=${response.status} recipient=${normalizedTo} body=${bodyText}`,
        );
        return {
          status: 'FAILED',
          errorMessage:
            parsed.message ?? `Termii returned HTTP ${response.status}`,
        };
      }

      if (parsed.code && parsed.code !== 'ok') {
        this.logger.error(
          `Termii SMS error code=${parsed.code} recipient=${normalizedTo} body=${bodyText}`,
        );
        return {
          status: 'FAILED',
          errorMessage: parsed.message ?? `Termii code: ${parsed.code}`,
        };
      }

      const providerMessageId =
        parsed.message_id_str ?? parsed.message_id ?? undefined;

      this.logger.log(
        `Termii SMS sent recipient=${normalizedTo} messageId=${providerMessageId ?? 'n/a'}`,
      );
      return {
        status: 'SENT',
        provider: 'termii',
        providerMessageId,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown Termii SMS error';
      this.logger.error(
        `Termii SMS send error recipient=${normalizedTo}: ${errorMessage}`,
      );
      return { status: 'FAILED', errorMessage };
    }
  }
}
