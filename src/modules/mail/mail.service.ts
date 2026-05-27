import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerClient } from 'postmark';
import { ChannelSendResult } from '../../common/types/channel-send-result';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private postmarkClient: ServerClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getPostmarkClient(): ServerClient | null {
    const token = this.config.get<string>('POSTMARK_SERVER_TOKEN')?.trim();
    if (!token) return null;
    if (!this.postmarkClient) {
      this.postmarkClient = new ServerClient(token);
    }
    return this.postmarkClient;
  }

  private postmarkFrom(): string | null {
    return this.config.get<string>('POSTMARK_FROM')?.trim() || null;
  }

  private messageStream(): string {
    return (
      this.config.get<string>('POSTMARK_MESSAGE_STREAM')?.trim() || 'outbound'
    );
  }

  private async sendViaPostmark(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<ChannelSendResult> {
    const to = params.to?.trim();
    if (!to) {
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const client = this.getPostmarkClient();
    const from = this.postmarkFrom();

    if (!client) {
      this.logger.warn(
        `POSTMARK_SERVER_TOKEN not set; email not sent. recipient=${to}`,
      );
      return { status: 'SKIPPED_CONFIG' };
    }

    if (!from) {
      this.logger.warn(
        'POSTMARK_FROM not set; email skipped (verify sender in Postmark).',
      );
      return { status: 'SKIPPED_CONFIG' };
    }

    try {
      const response = await client.sendEmail({
        From: from,
        To: to,
        Subject: params.subject,
        TextBody: params.text,
        HtmlBody: params.html ?? params.text.replace(/\n/g, '<br/>'),
        MessageStream: this.messageStream(),
      });

      this.logger.log(
        `Postmark email sent recipient=${to} messageId=${response.MessageID}`,
      );
      return {
        status: 'SENT',
        provider: 'postmark',
        providerMessageId: response.MessageID,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown Postmark send error';
      this.logger.error(
        `Postmark send failed recipient=${to}: ${errorMessage}`,
      );
      return { status: 'FAILED', errorMessage };
    }
  }

  /**
   * Sends the reset code when Postmark is configured. Otherwise skips send; the code is only in DB
   * (and this log) for administrators to relay to staff until Postmark is connected.
   */
  async sendStaffPasswordResetCode(to: string, code: string): Promise<void> {
    const subject = 'Password reset code';
    const text = `Your password reset code is: ${code}\n\nThis code expires in 15 minutes. If you did not request this, you can ignore this email.`;
    const html = `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p><p>If you did not request this, you can ignore this email.</p>`;

    const result = await this.sendViaPostmark({ to, subject, text, html });

    if (result.status === 'SKIPPED_CONFIG') {
      this.logger.warn(
        `Postmark not configured; password reset email not sent. recipient=${to}. ` +
          `Code is stored in StaffPasswordReset for admin to share with staff. code=${code}`,
      );
      return;
    }

    if (result.status === 'FAILED') {
      throw new ServiceUnavailableException(
        'Could not send email; try again later.',
      );
    }
  }

  /**
   * Sends appointment notification email via Postmark.
   * Returns SKIPPED_CONFIG when Postmark is not set (does not throw).
   */
  async sendAppointmentNotification(params: {
    to: string;
    subject: string;
    text: string;
  }): Promise<ChannelSendResult> {
    const html = `<p>${params.text.replace(/\n/g, '<br/>')}</p>`;
    return this.sendViaPostmark({
      to: params.to,
      subject: params.subject,
      text: params.text,
      html,
    });
  }
}
