import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientFamilyService } from '../patient-family/patient-family.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { ListMedicalRecordsQueryDto } from './dto/list-medical-records-query.dto';
import {
  toMedicalRecordAllergyDto,
  toMedicalRecordLabResultDto,
  toMedicalRecordRecentDiagnosisDto,
  toEncounterDetailDto,
  toEncounterSummaryDto,
  toLatestVitalsDto,
} from './patient-medical-records.util';

const HOME_VITALS_SELECT = {
  pulseRate: true,
  systolic: true,
  diastolic: true,
  recordedAt: true,
} as const;

const HOME_VITALS_OR = [
  { pulseRate: { not: null } },
  { systolic: { not: null } },
  { diastolic: { not: null } },
] as const;

const ENCOUNTER_LIST_INCLUDE = {
  doctor: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  diagnoses: {
    select: {
      primaryIcdDescription: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} as const;

const ENCOUNTER_DETAIL_INCLUDE = {
  doctor: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  diagnoses: {
    orderBy: { createdAt: 'desc' as const },
  },
  patientVitals: {
    orderBy: { recordedAt: 'desc' as const },
    take: 1,
    select: {
      systolic: true,
      diastolic: true,
      temperature: true,
      height: true,
      weight: true,
      bmi: true,
      pulseRate: true,
      respRate: true,
      spo2: true,
      painScore: true,
      bloodGlucose: true,
      recordedAt: true,
    },
  },
  prescriptions: {
    orderBy: { startDate: 'desc' as const },
    select: {
      id: true,
      drug: true,
      dosage: true,
      notes: true,
      startDate: true,
      endDate: true,
      items: {
        select: {
          dosage: true,
          frequency: true,
          duration: true,
          instructions: true,
          drug: {
            select: {
              brandName: true,
              genericName: true,
            },
          },
          consumable: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class PatientMedicalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly family: PatientFamilyService,
  ) {}

  async getDashboard(user: PatientJwtPayload, forPatientId?: string) {
    const subjectPatientId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );
    const [
      latestBloodGroupRecord,
      latestHeightWeight,
      latestHomeVitalsRow,
      allergies,
      recentDiagnoses,
      recentLabResults,
    ] = await Promise.all([
      this.prisma.pregnancy.findFirst({
        where: { patientId: subjectPatientId, bloodGroup: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { bloodGroup: true },
      }),
      this.prisma.patientVitals.findFirst({
        where: { patientId: subjectPatientId },
        orderBy: { recordedAt: 'desc' },
        select: { height: true, weight: true },
      }),
      this.findLatestHomeVitals(subjectPatientId),
      this.prisma.patientAllergy.findMany({
        where: { patientId: subjectPatientId },
        orderBy: { createdAt: 'desc' },
        select: { allergen: true, severity: true },
      }),
      this.prisma.encounterDiagnosis.findMany({
        where: { encounter: { patientId: subjectPatientId } },
        orderBy: { createdAt: 'desc' },
        take: 2,
        include: {
          encounter: {
            select: {
              status: true,
              doctor: {
                select: {
                  firstName: true,
                  lastName: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.labResult.findMany({
        where: { orderItem: { order: { patientId: subjectPatientId } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          value: true,
          abnormalFlag: true,
          createdAt: true,
          field: {
            select: {
              label: true,
              referenceRange: true,
            },
          },
        },
      }),
    ]);

    const bloodType = latestBloodGroupRecord?.bloodGroup ?? null;

    return {
      bloodType,
      heightCm: latestHeightWeight?.height ?? null,
      weightKg: latestHeightWeight?.weight ?? null,
      latestVitals: toLatestVitalsDto(latestHomeVitalsRow),
      allergies: allergies.map(toMedicalRecordAllergyDto),
      recentDiagnoses: recentDiagnoses.map(toMedicalRecordRecentDiagnosisDto),
      immunizations: [],
      recentLabResults: recentLabResults.map(toMedicalRecordLabResultDto),
      subjectPatientId,
    };
  }

  async listMedicalRecords(
    user: PatientJwtPayload,
    query: ListMedicalRecordsQueryDto,
  ) {
    const subjectPatientId = await this.family.resolveSubjectPatientId(
      user,
      query.forPatientId,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = { patientId: subjectPatientId };

    const [encounters, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
        include: ENCOUNTER_LIST_INCLUDE,
      }),
      this.prisma.encounter.count({ where }),
    ]);

    return {
      data: encounters.map(toEncounterSummaryDto),
      total,
      page,
      limit,
      subjectPatientId,
    };
  }

  async getEncounter(
    user: PatientJwtPayload,
    id: string,
    forPatientId?: string,
  ) {
    const subjectPatientId = await this.family.resolveSubjectPatientId(
      user,
      forPatientId,
    );
    const encounter = await this.prisma.encounter.findFirst({
      where: {
        id,
        patientId: subjectPatientId,
      },
      include: ENCOUNTER_DETAIL_INCLUDE,
    });

    if (!encounter) {
      throw new NotFoundException(`Medical record "${id}" not found.`);
    }

    return toEncounterDetailDto(encounter);
  }

  private async findLatestHomeVitals(patientId: string) {
    const baseWhere = {
      patientId,
      OR: [...HOME_VITALS_OR],
    };

    const encounterVitals = await this.prisma.patientVitals.findFirst({
      where: { ...baseWhere, encounterId: { not: null } },
      orderBy: { recordedAt: 'desc' },
      select: HOME_VITALS_SELECT,
    });

    if (encounterVitals) {
      return encounterVitals;
    }

    return this.prisma.patientVitals.findFirst({
      where: baseWhere,
      orderBy: { recordedAt: 'desc' },
      select: HOME_VITALS_SELECT,
    });
  }
}
