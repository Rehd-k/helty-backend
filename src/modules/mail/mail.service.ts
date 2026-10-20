import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { ChannelSendResult } from '../../common/types/channel-send-result';

const DEFAULT_FROM = 'StreamTrust Diagnostics <lab@streamtrustdiagnostics.com>';

type MailAttachment = {
  filename: string;
  content: string;
  contentType: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private resendKey: string | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Resend | null {
    const key = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (!key) return null;
    if (!this.resend || this.resendKey !== key) {
      this.resend = new Resend(key);
      this.resendKey = key;
    }
    return this.resend;
  }

  private fromAddress(): string {
    return this.config.get<string>('RESEND_FROM')?.trim() || DEFAULT_FROM;
  }

  private async send(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    attachments?: MailAttachment[];
  }): Promise<ChannelSendResult> {
    const to = params.to?.trim();
    if (!to) {
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const client = this.getClient();
    if (!client) {
      this.logger.warn(
        `RESEND_API_KEY not set; email not sent. recipient=${to}`,
      );
      return { status: 'SKIPPED_CONFIG' };
    }

    try {
      const { data, error } = await client.emails.send({
        from: this.fromAddress(),
        to: [to],
        subject: params.subject,
        text: params.text,
        html: params.html ?? params.text.replace(/\n/g, '<br/>'),
        attachments: params.attachments,
      });

      if (error) {
        const errorMessage = error.message || 'Resend rejected the email';
        this.logger.error(
          `Resend send failed recipient=${to}: ${errorMessage}`,
        );
        return { status: 'FAILED', errorMessage };
      }

      this.logger.log(
        `Resend email sent recipient=${to} messageId=${data?.id ?? 'unknown'}`,
      );
      return {
        status: 'SENT',
        provider: 'resend',
        providerMessageId: data?.id,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown Resend send error';
      this.logger.error(`Resend send failed recipient=${to}: ${errorMessage}`);
      return { status: 'FAILED', errorMessage };
    }
  }

  /**
   * Sends the reset code when Resend is configured. Otherwise skips send; the code is only in DB
   * (and this log) for administrators to relay to staff until Resend is connected.
   */
  async sendStaffPasswordResetCode(to: string, code: string): Promise<void> {
    const subject = 'Password reset code';
    const text = `Your password reset code is: ${code}\n\nThis code expires in 15 minutes. If you did not request this, you can ignore this email.`;
    const html = `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p><p>If you did not request this, you can ignore this email.</p>`;

    const result = await this.send({ to, subject, text, html });

    if (result.status === 'SKIPPED_CONFIG') {
      this.logger.warn(
        `Resend not configured; password reset email not sent. recipient=${to}. ` +
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
   * Sends appointment notification email via Resend.
   * Returns SKIPPED_CONFIG when Resend is not set (does not throw).
   */
  async sendAppointmentNotification(params: {
    to: string;
    subject: string;
    text: string;
  }): Promise<ChannelSendResult> {
    const html = `<p>${params.text.replace(/\n/g, '<br/>')}</p>`;
    return this.send({
      to: params.to,
      subject: params.subject,
      text: params.text,
      html,
    });
  }

  /**
   * Emails a laboratory report PDF. The recipient must already be the
   * patient's address; this method does not look up contacts.
   */
  async sendLabResultsPdf(params: {
    to: string;
    subject: string;
    text: string;
    pdfBase64: string;
    filename: string;
  }): Promise<ChannelSendResult> {
    const pdfBase64 = params.pdfBase64.replace(/\s/g, '');
    const bytes = Buffer.from(pdfBase64, 'base64');
    if (!pdfBase64 || bytes.length === 0) {
      return {
        status: 'FAILED',
        errorMessage: 'Laboratory report PDF is empty.',
      };
    }
    if (bytes.length > 8 * 1024 * 1024) {
      return {
        status: 'FAILED',
        errorMessage: 'Laboratory report PDF is too large to email.',
      };
    }

    const html = `<p>${params.text.replace(/\n/g, '<br/>')}</p>`;
    return this.send({
      to: params.to,
      subject: params.subject,
      text: params.text,
      html,
      attachments: [
        {
          filename: params.filename,
          content: pdfBase64,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}
