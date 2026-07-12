import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PatientStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PATIENT_ACCOUNT_TYPE,
  PATIENT_AUTH_SELECT,
} from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { toPatientPortalDto } from '../patient-auth/patient-auth.util';
import { PatientPhotoStorageService } from './patient-photo-storage.service';

@Injectable()
export class PatientProfilePhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photoStorage: PatientPhotoStorageService,
  ) {}

  async uploadPhoto(user: PatientJwtPayload, file?: Express.Multer.File) {
    this.assertPatientToken(user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Photo file is required');
    }

    const patient = await this.findPatientForPhoto(user);
    if (patient.status === PatientStatus.DECEASED) {
      throw new ForbiddenException('Patient cannot update this profile');
    }

    if (patient.avatarUrl) {
      this.photoStorage.deleteIfExists(user.sub);
    }

    const avatarUrl = await this.photoStorage.processAndSave(
      user.sub,
      file.buffer,
    );

    const updated = await this.prisma.patient.update({
      where: { id: user.sub },
      data: { avatarUrl },
      select: PATIENT_AUTH_SELECT,
    });

    return toPatientPortalDto(updated);
  }

  async deletePhoto(user: PatientJwtPayload) {
    this.assertPatientToken(user);
    await this.findPatientForPhoto(user);

    this.photoStorage.deleteIfExists(user.sub);

    const updated = await this.prisma.patient.update({
      where: { id: user.sub },
      data: { avatarUrl: null },
      select: PATIENT_AUTH_SELECT,
    });

    return toPatientPortalDto(updated);
  }

  private async findPatientForPhoto(user: PatientJwtPayload) {
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
