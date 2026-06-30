import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PatientStatus } from '@prisma/client';
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
};

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

    const payload: PatientJwtPayload = {
      sub: patient.id,
      patientId: patient.patientId,
      accountType: PATIENT_ACCOUNT_TYPE,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      patient: toPatientPortalDto(patient),
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
    return { patient: toPatientPortalDto(patient) };
  }

  async logout(user: PatientJwtPayload) {
    this.assertPatientToken(user);
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
