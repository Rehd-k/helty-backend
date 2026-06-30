import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RadiologyRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { ListRadiologyReportsQueryDto } from './dto/list-radiology-reports-query.dto';
import {
  buildStatistics,
  computeProfileCompleteness,
  isPendingReviewStatus,
  toRadiologyReportDetailDto,
  toRadiologyReportSummaryDto,
} from './patient-radiology-reports.util';
import { patientNameOnlySelect } from '../../common/utils/patient-display-name.util';

const PATIENT_ITEM_WHERE = {
  status: { not: RadiologyRequestStatus.CANCELLED },
} as const;

const RADIOLOGY_ITEM_LIST_INCLUDE = {
  order: {
    select: {
      requestedBy: { select: { firstName: true, lastName: true } },
    },
  },
  procedure: { select: { startTime: true, endTime: true } },
  report: {
    select: {
      signedAt: true,
      findings: true,
      impression: true,
      signedBy: { select: { firstName: true, lastName: true } },
    },
  },
  invoiceItem: {
    select: { service: { select: { name: true } } },
  },
} as const;

const RADIOLOGY_ITEM_DETAIL_INCLUDE = RADIOLOGY_ITEM_LIST_INCLUDE;

@Injectable()
export class PatientRadiologyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getApiBaseUrl(): string {
    return this.config.get<string>('PUBLIC_API_BASE_URL')?.replace(/\/$/, '') ?? '';
  }

  private patientItemWhere(patientId: string) {
    return {
      ...PATIENT_ITEM_WHERE,
      order: { patientId },
    };
  }

  async listRadiologyReports(
    user: PatientJwtPayload,
    query: ListRadiologyReportsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.patientItemWhere(user.sub);
    const apiBaseUrl = this.getApiBaseUrl();

    const [items, total, statusRows, patient] = await Promise.all([
      this.prisma.radiologyOrderItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { report: { signedAt: 'desc' } },
          { procedure: { endTime: 'desc' } },
          { createdAt: 'desc' },
        ],
        include: RADIOLOGY_ITEM_LIST_INCLUDE,
      }),
      this.prisma.radiologyOrderItem.count({ where }),
      this.prisma.radiologyOrderItem.findMany({
        where,
        select: { status: true },
      }),
      this.prisma.patient.findUnique({
        where: { id: user.sub },
        select: {
          ...patientNameOnlySelect,
          dob: true,
          gender: true,
          phoneNumber: true,
          email: true,
          addressOfResidence: true,
          nextOfKinName: true,
          nextOfKinPhone: true,
          hmoId: true,
          maritalStatus: true,
          nationality: true,
        },
      }),
    ]);

    const pendingReviews = statusRows.filter((row) =>
      isPendingReviewStatus(row.status),
    ).length;

    return {
      data: items.map((item) =>
        toRadiologyReportSummaryDto(item, apiBaseUrl),
      ),
      total,
      page,
      limit,
      statistics: buildStatistics(
        total,
        pendingReviews,
        patient ? computeProfileCompleteness(patient) : 0,
      ),
    };
  }

  async getRadiologyReport(user: PatientJwtPayload, id: string) {
    const apiBaseUrl = this.getApiBaseUrl();

    const item = await this.prisma.radiologyOrderItem.findFirst({
      where: {
        id,
        ...this.patientItemWhere(user.sub),
      },
      include: RADIOLOGY_ITEM_DETAIL_INCLUDE,
    });

    if (!item) {
      throw new NotFoundException(`Radiology report "${id}" not found.`);
    }

    return toRadiologyReportDetailDto(item, apiBaseUrl);
  }
}
