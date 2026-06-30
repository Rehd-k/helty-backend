import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { ListMedicalRecordsQueryDto } from './dto/list-medical-records-query.dto';
import {
  toEncounterDetailDto,
  toEncounterSummaryDto,
} from './patient-medical-records.util';

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
  constructor(private readonly prisma: PrismaService) {}

  async listMedicalRecords(
    user: PatientJwtPayload,
    query: ListMedicalRecordsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = { patientId: user.sub };

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
    };
  }

  async getEncounter(user: PatientJwtPayload, id: string) {
    const encounter = await this.prisma.encounter.findFirst({
      where: {
        id,
        patientId: user.sub,
      },
      include: ENCOUNTER_DETAIL_INCLUDE,
    });

    if (!encounter) {
      throw new NotFoundException(`Medical record "${id}" not found.`);
    }

    return toEncounterDetailDto(encounter);
  }
}
