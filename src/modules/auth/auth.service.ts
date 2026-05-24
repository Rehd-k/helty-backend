import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { StaffService } from '../staff/staff.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  activeStaffPasswordResetWhere,
  normalizePasswordResetCode,
  normalizePasswordResetEmail,
} from '../staff/staff-password-reset.query';

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly staffService: StaffService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async validateUser(identifier: string, pass: string) {
    const user = await this.staffService.findByEmailOrPhone(identifier);
    if (user && user.password) {
      const match = await bcrypt.compare(pass, user.password);
      if (match) {
        // strip password before returning
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      staffId: user.staffId,
      accountType: user.accountType,
      staffRole: user.staffRole,
      department: user.department?.name || null,
      departmentHead: user.headedDepartment ? true : false,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      staff: user,
    };
  }

  /**
   * Always returns the same shape so callers cannot infer whether the email exists.
   */
  async requestForgotPassword(email: string) {
    const generic = {
      message:
        'If an account exists for this email, a verification code has been issued.',
    };

    const staff = await this.staffService.findActiveByEmailForPasswordReset(
      normalizePasswordResetEmail(email),
    );
    if (!staff?.email) {
      return generic;
    }

    const code = String(randomInt(100_000, 1_000_000));
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.staffPasswordReset.deleteMany({
        where: { staffId: staff.id, usedAt: null },
      }),
      this.prisma.staffPasswordReset.create({
        data: { staffId: staff.id, code, expiresAt },
      }),
    ]);

    try {
      await this.mailService.sendStaffPasswordResetCode(staff.email, code);
    } catch (err) {
      this.logger.warn(
        `Password reset code saved for staff ${staff.id} but email was not sent: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return generic;
  }

  async resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string,
  ) {
    const normalizedCode = normalizePasswordResetCode(code);
    const staff = await this.staffService.findActiveByEmailForPasswordReset(
      normalizePasswordResetEmail(email),
    );
    if (!staff) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const row = await this.prisma.staffPasswordReset.findFirst({
      where: {
        staffId: staff.id,
        code: normalizedCode,
        ...activeStaffPasswordResetWhere(),
      },
    });

    if (!row) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.prisma.$transaction([
      this.prisma.staffPasswordReset.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.staff.update({
        where: { id: staff.id },
        data: { password: await bcrypt.hash(newPassword, 10) },
      }),
    ]);

    return {
      message:
        'Password has been updated. You can sign in with your new password.',
    };
  }
}
