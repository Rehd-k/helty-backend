import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { staffBriefInclude } from '../../common/constants/staff-select.constants';
import {
  CreatePatientAllergyDto,
  UpdatePatientAllergyDto,
} from './dto/patient-allergy.dto';
import {
  CreatePatientImmunizationDto,
  UpdatePatientImmunizationDto,
} from './dto/patient-immunization.dto';

@Injectable()
export class PatientClinicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertPatientExists(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" not found.`);
    }
  }

  listAllergies(patientId: string) {
    return this.prisma.patientAllergy.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: staffBriefInclude,
    });
  }

  async createAllergy(
    patientId: string,
    dto: CreatePatientAllergyDto,
    staffId: string,
  ) {
    await this.assertPatientExists(patientId);
    return this.prisma.patientAllergy.create({
      data: {
        patientId,
        allergen: dto.allergen.trim(),
        reaction: dto.reaction?.trim() || null,
        severity: dto.severity ?? null,
        type: dto.type?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdById: staffId,
      },
      include: staffBriefInclude,
    });
  }

  async updateAllergy(
    patientId: string,
    allergyId: string,
    dto: UpdatePatientAllergyDto,
    staffId: string,
  ) {
    const existing = await this.prisma.patientAllergy.findFirst({
      where: { id: allergyId, patientId },
    });
    if (!existing) {
      throw new NotFoundException(`Allergy "${allergyId}" not found.`);
    }
    return this.prisma.patientAllergy.update({
      where: { id: allergyId },
      data: {
        ...(dto.allergen != null ? { allergen: dto.allergen.trim() } : {}),
        ...(dto.reaction !== undefined
          ? { reaction: dto.reaction?.trim() || null }
          : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.type !== undefined ? { type: dto.type?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        updatedById: staffId,
      },
      include: staffBriefInclude,
    });
  }

  async removeAllergy(patientId: string, allergyId: string) {
    const existing = await this.prisma.patientAllergy.findFirst({
      where: { id: allergyId, patientId },
    });
    if (!existing) {
      throw new NotFoundException(`Allergy "${allergyId}" not found.`);
    }
    await this.prisma.patientAllergy.delete({ where: { id: allergyId } });
  }

  listImmunizations(patientId: string) {
    return this.prisma.patientImmunization.findMany({
      where: { patientId },
      orderBy: { administeredAt: 'desc' },
      include: staffBriefInclude,
    });
  }

  async createImmunization(
    patientId: string,
    dto: CreatePatientImmunizationDto,
    staffId: string,
  ) {
    await this.assertPatientExists(patientId);
    return this.prisma.patientImmunization.create({
      data: {
        patientId,
        vaccineName: dto.vaccineName.trim(),
        detail: dto.detail?.trim() || null,
        doseNumber: dto.doseNumber ?? null,
        administeredAt: new Date(dto.administeredAt),
        createdById: staffId,
      },
      include: staffBriefInclude,
    });
  }

  async updateImmunization(
    patientId: string,
    immunizationId: string,
    dto: UpdatePatientImmunizationDto,
    staffId: string,
  ) {
    const existing = await this.prisma.patientImmunization.findFirst({
      where: { id: immunizationId, patientId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Immunization "${immunizationId}" not found.`,
      );
    }
    return this.prisma.patientImmunization.update({
      where: { id: immunizationId },
      data: {
        ...(dto.vaccineName != null
          ? { vaccineName: dto.vaccineName.trim() }
          : {}),
        ...(dto.detail !== undefined
          ? { detail: dto.detail?.trim() || null }
          : {}),
        ...(dto.doseNumber !== undefined ? { doseNumber: dto.doseNumber } : {}),
        ...(dto.administeredAt != null
          ? { administeredAt: new Date(dto.administeredAt) }
          : {}),
        updatedById: staffId,
      },
      include: staffBriefInclude,
    });
  }

  async removeImmunization(patientId: string, immunizationId: string) {
    const existing = await this.prisma.patientImmunization.findFirst({
      where: { id: immunizationId, patientId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Immunization "${immunizationId}" not found.`,
      );
    }
    await this.prisma.patientImmunization.delete({
      where: { id: immunizationId },
    });
  }
}
