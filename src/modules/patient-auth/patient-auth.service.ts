import { createHash, randomBytes, randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  PatientDeviceStatus,
  PatientPortalOtpPurpose,
  PatientStatus,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientActivatePasswordDto, PatientActivateRequestDto, PatientActivateVerifyDto } from './dto/patient-activate.dto';
import { PatientForgotPasswordRequestDto, PatientForgotPasswordResetDto } from './dto/patient-forgot-password.dto';
import { PatientDeviceFieldsDto } from './dto/patient-device-fields.dto';
import { PatientLoginDto } from './dto/patient-login.dto';
import { PatientRefreshDto } from './dto/patient-refresh.dto';
import {
  PATIENT_ACCOUNT_TYPE,
  PATIENT_AUTH_SELECT,
  isDeviceVerificationExempt,
} from './patient-auth.constants';
import { PatientOtpDeliveryService } from './patient-otp-delivery.service';
import { dobMatches, phoneLookupVariants, phonesMatch, toPatientPortalDto } from './patient-auth.util';

export type PatientJwtPayload = {
  sub: string;
  patientId: string;
  accountType: typeof PATIENT_ACCOUNT_TYPE;
  /** Bound device session; required for portal access after device approval rollout */
  deviceId?: string;
};

const DEVICE_SELECT = {
  id: true,
  deviceKey: true,
  platform: true,
  deviceLabel: true,
  status: true,
  approvedAt: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const PATIENT_CREDENTIAL_SELECT = {
  ...PATIENT_AUTH_SELECT,
  password: true,
  portalActivatedAt: true,
} satisfies Prisma.PatientSelect;

type PatientCredentialRecord = Prisma.PatientGetPayload<{
  select: typeof PATIENT_CREDENTIAL_SELECT;
}>;

const MISMATCH_MESSAGE =
  'Phone number or date of birth does not match our records.';
const INVALID_LOGIN_MESSAGE = 'Invalid phone number or password.';
const NOT_ACTIVATED_MESSAGE =
  'This account is not activated yet. Activate it with your date of birth.';
const ALREADY_ACTIVATED_MESSAGE =
  'This account is already activated. Sign in or reset your password.';
const INVALID_CODE_MESSAGE = 'Invalid or expired code.';
const SESSION_EXPIRED_MESSAGE = 'Session expired. Please sign in again.';

const OTP_TTL_MS = 10 * 60 * 1000;
const SETUP_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_REQUESTS_PER_HOUR = 5;
const BCRYPT_ROUNDS = 10;

@Injectable()
export class PatientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly otpDelivery: PatientOtpDeliveryService,
  ) {}

  async requestActivation(dto: PatientActivateRequestDto) {
    const patient = await this.findPatientByPhoneAndDob(dto.phoneNumber, dto.dob);
    const issued = await this.issueOtp(patient, PatientPortalOtpPurpose.ACTIVATION);
    return { ...issued, hasPassword: Boolean(patient.password) };
  }

  async verifyActivation(dto: PatientActivateVerifyDto) {
    const patient = await this.findPatientByPhone(dto.phoneNumber);
    if (!patient || patient.status === PatientStatus.DECEASED) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }
    const row = await this.matchActiveCode(
      patient.id,
      PatientPortalOtpPurpose.ACTIVATION,
      dto.code,
    );
    await this.upsertApprovedDevice(patient.id, dto);
    const hasPassword = Boolean(patient.password);
    if (hasPassword) {
      return { hasPassword: true as const };
    }
    const setupToken = randomBytes(32).toString('base64url');
    const setupTokenExpiresAt = new Date(Date.now() + SETUP_TTL_MS);
    await this.prisma.patientPortalOtp.update({
      where: { id: row.id },
      data: {
        setupTokenHash: hashToken(setupToken),
        setupTokenExpiresAt,
      },
    });
    return {
      hasPassword: false as const,
      setupToken,
      expiresInSeconds: Math.floor(SETUP_TTL_MS / 1000),
    };
  }

  async completeActivation(dto: PatientActivatePasswordDto) {
    const now = new Date();
    const row = await this.prisma.patientPortalOtp.findFirst({
      where: {
        purpose: PatientPortalOtpPurpose.ACTIVATION,
        setupTokenHash: hashToken(dto.setupToken),
        usedAt: null,
        setupTokenExpiresAt: { gt: now },
        attempts: { lt: MAX_OTP_ATTEMPTS },
      },
    });
    if (!row) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: row.patientId },
      select: PATIENT_CREDENTIAL_SELECT,
    });
    if (
      !patient?.patientId ||
      !patient.dob ||
      patient.status === PatientStatus.DECEASED
    ) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }
    if (patient.password) {
      throw new ConflictException(ALREADY_ACTIVATED_MESSAGE);
    }

    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.patient.update({
        where: { id: patient.id },
        data: { password, portalActivatedAt: now },
      }),
      this.prisma.patientPortalOtp.update({
        where: { id: row.id },
        data: { usedAt: now, setupTokenHash: null, setupTokenExpiresAt: null },
      }),
    ]);

    const device = await this.upsertApprovedDevice(patient.id, dto);
    return this.issueSession({ ...patient, password }, device.id);
  }

  async login(dto: PatientLoginDto) {
    const patient = await this.findPatientByPhone(dto.phoneNumber);
    if (
      !patient?.patientId ||
      patient.status === PatientStatus.DECEASED
    ) {
      throw new BadRequestException(INVALID_LOGIN_MESSAGE);
    }
    if (!patient.password) {
      throw new BadRequestException(NOT_ACTIVATED_MESSAGE);
    }
    const matches = await bcrypt.compare(dto.password, patient.password);
    if (!matches) {
      throw new BadRequestException(INVALID_LOGIN_MESSAGE);
    }

    const device = await this.requireVerifiedDevice(patient.id, dto);
    return this.issueSession(patient, device.id);
  }

  async requestPasswordReset(dto: PatientForgotPasswordRequestDto) {
    const patient = await this.findPatientByPhoneAndDob(dto.phoneNumber, dto.dob);
    if (!patient.password) {
      throw new BadRequestException(NOT_ACTIVATED_MESSAGE);
    }
    return this.issueOtp(patient, PatientPortalOtpPurpose.PASSWORD_RESET);
  }

  async resetPassword(dto: PatientForgotPasswordResetDto) {
    const patient = await this.findPatientByPhone(dto.phoneNumber);
    if (
      !patient?.patientId ||
      !patient.password ||
      patient.status === PatientStatus.DECEASED
    ) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }
    const row = await this.matchActiveCode(
      patient.id,
      PatientPortalOtpPurpose.PASSWORD_RESET,
      dto.code,
    );
    const now = new Date();
    const password = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.patient.update({
        where: { id: patient.id },
        data: { password, portalActivatedAt: patient.portalActivatedAt ?? now },
      }),
      this.prisma.patientPortalOtp.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
    ]);
    const device = await this.upsertApprovedDevice(patient.id, dto);
    return this.issueSession({ ...patient, password }, device.id);
  }

  async refresh(dto: PatientRefreshDto) {
    const deviceKey = dto.deviceKey.trim();
    const device = await this.prisma.patientDevice.findUnique({
      where: { deviceKey },
    });
    if (!device || device.status !== PatientDeviceStatus.APPROVED) {
      throw new UnauthorizedException({
        message: 'This phone is no longer verified. Request a new code.',
        code: 'DEVICE_REVOKED',
      });
    }
    if (
      !device.refreshTokenHash ||
      !device.refreshTokenExpiresAt ||
      device.refreshTokenExpiresAt.getTime() <= Date.now() ||
      device.refreshTokenHash !== hashToken(dto.refreshToken)
    ) {
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: device.patientId },
      select: PATIENT_CREDENTIAL_SELECT,
    });
    if (
      !patient?.patientId ||
      !patient.password ||
      patient.status === PatientStatus.DECEASED
    ) {
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }

    await this.prisma.patientDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
    return this.issueSession(patient, device.id);
  }

  async listLoginCodes() {
    const includeCode = this.otpDelivery.channels().has('staff');
    const sentToPhone = this.otpDelivery.mode() !== 'staff';
    const now = new Date();
    const rows = await this.prisma.patientPortalOtp.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: MAX_OTP_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        patient: {
          select: {
            patientId: true,
            firstName: true,
            otherName: true,
            surname: true,
            phoneNumber: true,
          },
        },
      },
    });

    return {
      delivery: this.otpDelivery.mode(),
      data: rows.map((row) => ({
        id: row.id,
        purpose: row.purpose,
        hospitalPatientId: row.patient.patientId,
        patientName: [row.patient.firstName, row.patient.otherName, row.patient.surname]
          .filter((part) => part && part.trim())
          .join(' '),
        phoneNumber: row.patient.phoneNumber,
        code: includeCode ? row.code : null,
        sentToPhone,
        requestedAt: row.createdAt,
        expiresAt: row.expiresAt,
      })),
    };
  }

  async getMe(user: PatientJwtPayload) {
    this.assertPatientToken(user);
    const patient = await this.prisma.patient.findUnique({
      where: { id: user.sub },
      select: PATIENT_AUTH_SELECT,
    });
    if (!patient?.patientId) {
      throw new NotFoundException('Patient not found');
    }

    const device = await this.resolveDeviceForUser(user);

    return {
      patient: toPatientPortalDto(patient),
      device,
      deviceStatus: device?.status ?? null,
    };
  }

  async logout(user: PatientJwtPayload) {
    this.assertPatientToken(user);
    if (!user.deviceId) return;

    const device = await this.prisma.patientDevice.findUnique({
      where: { id: user.deviceId },
      select: { id: true, patientId: true },
    });
    if (device?.patientId === user.sub) {
      await this.prisma.patientDevice.update({
        where: { id: device.id },
        data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
      });
    }
  }

  private async issueOtp(
    patient: PatientCredentialRecord,
    purpose: PatientPortalOtpPurpose,
  ) {
    await this.assertOtpRateLimit(patient.id);
    const code = String(randomInt(100_000, 1_000_000));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.patientPortalOtp.updateMany({
        where: { patientId: patient.id, purpose, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.patientPortalOtp.create({
        data: {
          patientId: patient.id,
          code,
          purpose,
          expiresAt,
        },
      }),
    ]);
    const delivery = await this.otpDelivery.deliver(
      patient.phoneNumber ?? '',
      code,
    );
    return {
      delivery,
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    };
  }

  private async assertOtpRateLimit(patientId: string) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const count = await this.prisma.patientPortalOtp.count({
      where: { patientId, createdAt: { gte: since } },
    });
    if (count >= MAX_OTP_REQUESTS_PER_HOUR) {
      throw new HttpException(
        'Too many codes were requested. Try again in a little while.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async matchActiveCode(
    patientId: string,
    purpose: PatientPortalOtpPurpose,
    code: string,
  ) {
    const normalized = code.trim();
    const row = await this.prisma.patientPortalOtp.findFirst({
      where: {
        patientId,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: MAX_OTP_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.code !== normalized) {
      if (row) {
        const attempts = row.attempts + 1;
        await this.prisma.patientPortalOtp.update({
          where: { id: row.id },
          data: {
            attempts,
            ...(attempts >= MAX_OTP_ATTEMPTS ? { usedAt: new Date() } : {}),
          },
        });
      }
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }
    return row;
  }

  private async issueSession(patient: PatientCredentialRecord, deviceId: string) {
    if (!patient.patientId) {
      throw new BadRequestException(INVALID_LOGIN_MESSAGE);
    }
    const payload: PatientJwtPayload = {
      sub: patient.id,
      patientId: patient.patientId,
      accountType: PATIENT_ACCOUNT_TYPE,
      deviceId,
    };
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const device = await this.prisma.patientDevice.update({
      where: { id: deviceId },
      data: {
        refreshTokenHash: hashToken(refreshToken),
        refreshTokenExpiresAt,
        lastSeenAt: new Date(),
      },
      select: DEVICE_SELECT,
    });
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken,
      patient: toPortalPatient(patient),
      device,
    };
  }

  private async findPatientByPhone(phoneNumber: string) {
    const variants = phoneLookupVariants(phoneNumber);
    if (variants.length === 0) return null;
    const rows = await this.prisma.patient.findMany({
      where: { phoneNumber: { in: variants } },
      select: PATIENT_CREDENTIAL_SELECT,
    });
    const matched = rows.filter((row) => phonesMatch(row.phoneNumber, phoneNumber));
    if (matched.length !== 1) return null;
    return matched[0];
  }

  private async findPatientByPhoneAndDob(phoneNumber: string, dob: string) {
    const patient = await this.findPatientByPhone(phoneNumber);
    if (
      !patient?.patientId ||
      !patient.dob ||
      patient.status === PatientStatus.DECEASED ||
      !dobMatches(patient.dob, dob)
    ) {
      throw new BadRequestException(MISMATCH_MESSAGE);
    }
    return patient;
  }

  private async resolveDeviceForUser(user: PatientJwtPayload) {
    if (!user.deviceId) return null;

    const device = await this.prisma.patientDevice.findUnique({
      where: { id: user.deviceId },
      select: DEVICE_SELECT,
    });

    return this.autoApproveExemptDevice(user.patientId, device);
  }

  private async autoApproveExemptDevice(
    hospitalPatientId: string,
    device: {
      id: string;
      status: PatientDeviceStatus;
      approvedAt: Date | null;
    } | null,
  ) {
    if (!device) return null;
    if (device.status === PatientDeviceStatus.APPROVED) return device;
    if (!isDeviceVerificationExempt(hospitalPatientId)) return device;

    return this.prisma.patientDevice.update({
      where: { id: device.id },
      data: {
        status: PatientDeviceStatus.APPROVED,
        approvedAt: device.approvedAt ?? new Date(),
      },
      select: DEVICE_SELECT,
    });
  }

  private async requireVerifiedDevice(
    patientId: string,
    dto: PatientDeviceFieldsDto,
  ) {
    const deviceKey = dto.deviceKey.trim();
    if (!deviceKey) {
      throw new BadRequestException('deviceKey is required');
    }
    await this.releaseForeignFcmToken(deviceKey, dto.fcmToken);

    const existing = await this.prisma.patientDevice.findUnique({
      where: { deviceKey },
    });
    if (
      !existing ||
      existing.patientId !== patientId ||
      existing.status !== PatientDeviceStatus.APPROVED
    ) {
      throw new ForbiddenException({
        message:
          'This phone is not verified yet. Confirm it with a code first.',
        code: 'DEVICE_VERIFICATION_REQUIRED',
      });
    }

    const platform = dto.platform?.trim() || null;
    const deviceLabel = dto.deviceLabel?.trim() || null;
    const fcmToken = dto.fcmToken?.trim() || null;
    return this.prisma.patientDevice.update({
      where: { id: existing.id },
      data: {
        platform,
        deviceLabel,
        ...(fcmToken ? { fcmToken } : {}),
        lastSeenAt: new Date(),
      },
      select: DEVICE_SELECT,
    });
  }

  private async releaseForeignFcmToken(
    deviceKey: string,
    fcmToken: string | undefined,
  ) {
    const token = fcmToken?.trim();
    if (!token) return;
    const tokenOwner = await this.prisma.patientDevice.findUnique({
      where: { fcmToken: token },
      select: { id: true, deviceKey: true },
    });
    if (tokenOwner && tokenOwner.deviceKey !== deviceKey) {
      await this.prisma.patientDevice.update({
        where: { id: tokenOwner.id },
        data: { fcmToken: null },
      });
    }
  }

  private async upsertApprovedDevice(
    patientId: string,
    dto: PatientDeviceFieldsDto,
  ) {
    const deviceKey = dto.deviceKey.trim();
    if (!deviceKey) {
      throw new BadRequestException('deviceKey is required');
    }

    const platform = dto.platform?.trim() || null;
    const deviceLabel = dto.deviceLabel?.trim() || null;
    const fcmToken = dto.fcmToken?.trim() || null;
    const now = new Date();

    const existing = await this.prisma.patientDevice.findUnique({
      where: { deviceKey },
    });

    await this.releaseForeignFcmToken(deviceKey, fcmToken ?? undefined);

    const approved = {
      status: PatientDeviceStatus.APPROVED,
      approvedAt: now,
      platform,
      deviceLabel,
      ...(fcmToken ? { fcmToken } : {}),
      lastSeenAt: now,
    };

    if (existing && existing.patientId !== patientId) {
      return this.prisma.patientDevice.update({
        where: { id: existing.id },
        data: {
          patientId,
          ...approved,
          approvedById: null,
          refreshTokenHash: null,
          refreshTokenExpiresAt: null,
        },
        select: DEVICE_SELECT,
      });
    }

    if (existing) {
      return this.prisma.patientDevice.update({
        where: { id: existing.id },
        data: {
          ...approved,
          approvedAt: existing.approvedAt ?? now,
        },
        select: DEVICE_SELECT,
      });
    }

    return this.prisma.patientDevice.create({
      data: {
        patientId,
        deviceKey,
        platform,
        deviceLabel,
        fcmToken,
        status: PatientDeviceStatus.APPROVED,
        approvedAt: now,
        lastSeenAt: now,
      },
      select: DEVICE_SELECT,
    });
  }

  private assertPatientToken(user: PatientJwtPayload) {
    if (!user?.sub || user.accountType !== PATIENT_ACCOUNT_TYPE) {
      throw new ForbiddenException('Access denied');
    }
  }
}

function toPortalPatient(patient: PatientCredentialRecord) {
  const { password: _password, portalActivatedAt: _activated, ...rest } = patient;
  return toPatientPortalDto(rest);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
