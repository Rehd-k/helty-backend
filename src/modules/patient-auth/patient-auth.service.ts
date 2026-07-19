import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PatientDeviceStatus, PatientStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientLoginDto } from './dto/patient-login.dto';
import {
  PATIENT_ACCOUNT_TYPE,
  PATIENT_AUTH_SELECT,
  PatientAuthRecord,
} from './patient-auth.constants';
import { dobMatches, toPatientPortalDto } from './patient-auth.util';

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

const INVALID_CREDENTIALS_MESSAGE =
  'Invalid patient ID or date of birth';

@Injectable()
export class PatientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: PatientLoginDto) {
    const patient = await this.findPatientForAuth(dto.patientId);
    this.validatePatientCredentials(patient, dto.dob);

    const device = await this.upsertDeviceForLogin(patient.id, dto);

    const payload: PatientJwtPayload = {
      sub: patient.id,
      patientId: patient.patientId,
      accountType: PATIENT_ACCOUNT_TYPE,
      deviceId: device.id,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      patient: toPatientPortalDto(patient),
      device,
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

    const device = user.deviceId
      ? await this.prisma.patientDevice.findUnique({
          where: { id: user.deviceId },
          select: DEVICE_SELECT,
        })
      : null;

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
      await this.prisma.patientDevice.delete({ where: { id: device.id } });
    }
  }

  private async upsertDeviceForLogin(
    patientId: string,
    dto: PatientLoginDto,
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

    if (existing && existing.patientId !== patientId) {
      throw new ConflictException({
        message: 'This device is already registered to another patient.',
        code: 'DEVICE_OWNED_BY_OTHER_PATIENT',
      });
    }

    if (fcmToken) {
      const tokenOwner = await this.prisma.patientDevice.findUnique({
        where: { fcmToken },
        select: { id: true, deviceKey: true },
      });
      if (tokenOwner && tokenOwner.deviceKey !== deviceKey) {
        await this.prisma.patientDevice.update({
          where: { id: tokenOwner.id },
          data: { fcmToken: null },
        });
      }
    }

    if (existing) {
      return this.prisma.patientDevice.update({
        where: { id: existing.id },
        data: {
          platform,
          deviceLabel,
          ...(fcmToken ? { fcmToken } : {}),
          lastSeenAt: now,
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
        status: PatientDeviceStatus.PENDING,
        lastSeenAt: now,
      },
      select: DEVICE_SELECT,
    });
  }

  private async findPatientForAuth(patientId: string) {
    const trimmedId = patientId.trim();
    if (!trimmedId) {
      throw new BadRequestException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.prisma.patient.findFirst({
      where: {
        patientId: { equals: trimmedId, mode: 'insensitive' },
      },
      select: PATIENT_AUTH_SELECT,
    });
  }

  private validatePatientCredentials(
    patient: Awaited<ReturnType<PatientAuthService['findPatientForAuth']>>,
    dob: string,
  ): asserts patient is PatientAuthRecord & { patientId: string; dob: Date } {
    if (
      !patient?.patientId ||
      !patient.dob ||
      patient.status === PatientStatus.DECEASED ||
      !dobMatches(patient.dob, dob)
    ) {
      throw new BadRequestException(INVALID_CREDENTIALS_MESSAGE);
    }
  }

  private assertPatientToken(user: PatientJwtPayload) {
    if (!user?.sub || user.accountType !== PATIENT_ACCOUNT_TYPE) {
      throw new ForbiddenException('Access denied');
    }
  }
}
