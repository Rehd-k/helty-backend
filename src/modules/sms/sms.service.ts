import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { outboundMessagingIsOff } from '../../common/messaging/outbound-messaging';
import { ChannelSendResult } from '../../common/types/channel-send-result';
import { normalizePhoneForTermii } from './termii-phone.util';

const DEFAULT_TERMII_BASE_URL = 'https://v4.api.termii.com';
const DEFAULT_TERMII_SENDER_ID = 'N-Alert';
const DEFAULT_TERMII_CHANNEL = 'dnd';
const DEFAULT_TERMII_TYPE = 'plain';

/** Termii Messaging API request (https://developers.termii.com/messaging-api). */
interface TermiiSendRequest {
  api_key: string;
  to: string;
  from: string;
  sms: string;
  type: string;
  channel: string;
}

/** Termii send SMS success payload (https://developers.termii.com/messaging-api). */
interface TermiiSendResponse {
  code?: string;
  message?: string;
  message_id?: string;
  message_id_str?: string;
}

interface TermiiSendOptions {
  channel: string;
  senderEnv: string;
  label: string;
  /** OTP sends surface provider failures as BadGatewayException. */
  throwOnFailure?: boolean;
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
   * Sends a patient OTP SMS via Termii (POST {TERMII_BASE_URL}/api/sms/number/send).
   * Provider failures throw BadGatewayException. The message text is never logged.
   */
  sendOtpSms(to: string, message: string): Promise<ChannelSendResult> {
    return this.sendTermii(to, message, {
      channel: this.smsChannel(),
      senderEnv: 'TERMII_SENDER_ID',
      label: 'OTP SMS',
      throwOnFailure: true,
    });
  }

  /**
   * Sends a WhatsApp message via Termii on the same /api/sms/number/send endpoint.
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
   * Sends SMS via Termii (POST {TERMII_BASE_URL}/api/sms/number/send).
   * Skips when Termii env is missing or phone cannot be normalized.
   */
  sendAppointmentSms(to: string, message: string): Promise<ChannelSendResult> {
    return this.sendTermii(to, message, {
      channel: this.smsChannel(),
      senderEnv: 'TERMII_SENDER_ID',
      label: 'SMS',
    });
  }

  private smsChannel(): string {
    return (
      this.config.get<string>('TERMII_CHANNEL')?.trim() ||
      DEFAULT_TERMII_CHANNEL
    );
  }

  private resolveSender(senderEnv: string): string {
    const configured = this.config.get<string>(senderEnv)?.trim();
    if (configured) return configured;
    if (senderEnv === 'TERMII_SENDER_ID') return DEFAULT_TERMII_SENDER_ID;
    return '';
  }

  private async sendTermii(
    to: string,
    message: string,
    options: TermiiSendOptions,
  ): Promise<ChannelSendResult> {
    if (!to?.trim()) {
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    if (outboundMessagingIsOff(this.config, this.logger, options.label)) {
      return { status: 'SKIPPED_CONFIG' };
    }

    const apiKey = this.config.get<string>('TERMII_API_KEY')?.trim();
    const baseUrl =
      this.config.get<string>('TERMII_BASE_URL')?.trim() ||
      DEFAULT_TERMII_BASE_URL;
    const senderId = this.resolveSender(options.senderEnv);
    const type =
      this.config.get<string>('TERMII_TYPE')?.trim() || DEFAULT_TERMII_TYPE;
    if (!apiKey || !senderId) {
      const missing = [
        !apiKey ? 'TERMII_API_KEY' : null,
        !senderId ? options.senderEnv : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join(', ');
      this.logger.warn(
        `Termii ${options.label} not configured (${missing}); skipping.`,
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

    const url = `${baseUrl.replace(/\/$/, '')}/api/sms/number/send`;
    const payload: TermiiSendRequest = {
      api_key: apiKey,
      to: normalizedTo,
      from: senderId,
      sms: message,
      type,
      channel: options.channel,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const bodyText = await response.text();
      let parsed: TermiiSendResponse = {};
      try {
        parsed = JSON.parse(bodyText) as TermiiSendResponse;
      } catch {
        parsed = {};
      }

      if (!response.ok) {
        return this.failSend(
          options,
          normalizedTo,
          parsed.message?.trim() || 'SMS provider failed',
          `status=${response.status} termiiCode=${parsed.code ?? 'n/a'} termiiMessage=${parsed.message ?? 'n/a'}`,
        );
      }

      if (parsed.code && parsed.code !== 'ok') {
        return this.failSend(
          options,
          normalizedTo,
          parsed.message?.trim() || 'SMS provider failed',
          `status=${response.status} termiiCode=${parsed.code} termiiMessage=${parsed.message ?? 'n/a'}`,
        );
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
      if (err instanceof BadGatewayException) throw err;
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown Termii send error';
      this.logger.error(
        `Termii ${options.label} send error recipient=${normalizedTo}: ${errorMessage}`,
      );
      if (options.throwOnFailure) {
        throw new BadGatewayException('SMS provider failed');
      }
      return { status: 'FAILED', errorMessage };
    }
  }

  private failSend(
    options: TermiiSendOptions,
    recipient: string,
    errorMessage: string,
    details: string,
  ): ChannelSendResult {
    this.logger.error(
      `Termii ${options.label} failed recipient=${recipient} ${details}`,
    );
    if (options.throwOnFailure) {
      throw new BadGatewayException(errorMessage);
    }
    return { status: 'FAILED', errorMessage };
  }
}
