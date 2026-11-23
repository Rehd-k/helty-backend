import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PatientStatus, Prisma } from '@prisma/client';
import { formatPatientDisplayName } from '../../common/utils/patient-display-name.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PATIENT_ACCOUNT_TYPE,
  PATIENT_AUTH_SELECT,
} from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  toCalendarDateString,
  toPatientPortalDto,
} from '../patient-auth/patient-auth.util';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@Injectable()
export class PatientProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(user: PatientJwtPayload) {
    const patient = await this.findPatientForProfile(user);
    return toPatientPortalDto(patient);
  }

  async getHealthCard(user: PatientJwtPayload) {
    const patient = await this.findPatientForProfile(user);
    const [allergies, latestBloodGroupRecord] = await Promise.all([
      this.prisma.patientAllergy.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        select: { allergen: true, severity: true },
      }),
      this.prisma.pregnancy.findFirst({
        where: { patientId: patient.id, bloodGroup: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { bloodGroup: true },
      }),
    ]);

    const hospitalPatientId = patient.patientId?.trim() || null;
    const cardNo = patient.cardNo?.trim() || null;
    const qrPayload = hospitalPatientId || cardNo || patient.id;

    return {
      patientId: hospitalPatientId,
      cardNo,
      patientName: formatPatientDisplayName(patient),
      firstName: patient.firstName ?? null,
      surname: patient.surname ?? null,
      otherName: patient.otherName ?? null,
      dob: patient.dob ? toCalendarDateString(patient.dob) : null,
      bloodType: latestBloodGroupRecord?.bloodGroup ?? null,
      hmo: patient.hmo ?? patient.hmoProvider?.name ?? null,
      allergies: allergies.map((allergy) => ({
        name: allergy.allergen,
        severity: allergy.severity,
      })),
      avatarUrl: patient.avatarUrl ?? null,
      phoneNumber: patient.phoneNumber ?? null,
      qrPayload,
    };
  }

  async updateProfile(user: PatientJwtPayload, dto: UpdatePatientProfileDto) {
    if (
      dto.email === undefined &&
      dto.phoneNumber === undefined &&
      dto.addressOfResidence === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const patient = await this.findPatientForProfile(user);
    if (patient.status === PatientStatus.DECEASED) {
      throw new ForbiddenException('Patient cannot update this profile');
    }

    const data: Prisma.PatientUpdateInput = {};
    if (dto.email !== undefined) {
      data.email = dto.email;
    }
    if (dto.phoneNumber !== undefined) {
      data.phoneNumber = dto.phoneNumber;
    }
    if (dto.addressOfResidence !== undefined) {
      data.addressOfResidence = dto.addressOfResidence;
    }

    const updated = await this.prisma.patient.update({
      where: { id: user.sub },
      data,
      select: PATIENT_AUTH_SELECT,
    });

    return toPatientPortalDto(updated);
  }

  private async findPatientForProfile(user: PatientJwtPayload) {
    this.assertPatientToken(user);

    const patient = await this.prisma.patient.findUnique({
      where: { id: user.sub },
      select: PATIENT_AUTH_SELECT,
    });

    if (!patient?.patientId) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  private assertPatientToken(user: PatientJwtPayload) {
    if (!user?.sub || user.accountType !== PATIENT_ACCOUNT_TYPE) {
      throw new ForbiddenException('Access denied');
    }
  }
}
