import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private createTransport() {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) return null;
    return nodemailer.createTransport({
      host,
      port: Number(this.config.get('SMTP_PORT') || '587'),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.get<string>('SMTP_USER')?.trim(),
        pass: this.config.get<string>('SMTP_PASS')?.trim(),
      },
    });
  }

  /**
   * Sends the reset code when SMTP is configured. Otherwise skips send; the code is only in DB
   * (and this log) for administrators to relay to staff until SMTP is connected.
   */
  async sendStaffPasswordResetCode(to: string, code: string): Promise<void> {
    const transport = this.createTransport();
    const from =
      this.config.get<string>('SMTP_FROM')?.trim() ||
      this.config.get<string>('SMTP_USER')?.trim();
    const subject = 'Password reset code';
    const text = `Your password reset code is: ${code}\n\nThis code expires in 15 minutes. If you did not request this, you can ignore this email.`;
    const html = `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p><p>If you did not request this, you can ignore this email.</p>`;

    if (!transport) {
      this.logger.warn(
        `SMTP_HOST not set; password reset email not sent. recipient=${to}. ` +
          `Code is stored in StaffPasswordReset for admin to share with staff. code=${code}`,
      );
      return;
    }

    if (!from) {
      this.logger.error(
        'SMTP_FROM or SMTP_USER is required when SMTP_HOST is set',
      );
      throw new ServiceUnavailableException('Mail from-address not configured');
    }

    try {
      await transport.sendMail({ from, to, subject, text, html });
    } catch (err) {
      this.logger.error(
        `Failed to send password reset email: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'Could not send email; try again later.',
      );
    }
  }
}
