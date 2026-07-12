import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RadiologyRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { RadiologyImageService } from '../radiology/radiology-image.service';
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
      patientId: true,
      requestedBy: { select: { firstName: true, lastName: true } },
    },
  },
  procedure: { select: { startTime: true, endTime: true } },
  report: {
    select: {
      signedAt: true,
      findings: true,
      impression: true,
      recommendations: true,
      severity: true,
      signedBy: { select: { firstName: true, lastName: true } },
    },
  },
  invoiceItem: {
    select: {
      id: true,
      service: { select: { name: true } },
    },
  },
  images: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      uploadedAt: true,
    },
    orderBy: { uploadedAt: 'asc' as const },
  },
} as const;

const RADIOLOGY_ITEM_DETAIL_INCLUDE = RADIOLOGY_ITEM_LIST_INCLUDE;

@Injectable()
export class PatientRadiologyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly invoiceService: InvoiceService,
    private readonly radiologyImageService: RadiologyImageService,
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

  async canPatientAccessResults(
    patientId: string,
    invoiceItemId: string | null | undefined,
  ): Promise<boolean> {
    if (!invoiceItemId) {
      return true;
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.invoiceService.assertInvoiceItemPaidOrInpatientCredit(tx, {
          invoiceItemId,
          patientId,
        });
      });
      return true;
    } catch {
      return false;
    }
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

    const accessByItem = await Promise.all(
      items.map((item) =>
        this.canPatientAccessResults(user.sub, item.invoiceItem?.id),
      ),
    );

    return {
      data: items.map((item, index) =>
        toRadiologyReportSummaryDto(
          item,
          apiBaseUrl,
          accessByItem[index],
        ),
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

    const canAccessResults = await this.canPatientAccessResults(
      user.sub,
      item.invoiceItem?.id,
    );

    return toRadiologyReportDetailDto(item, apiBaseUrl, canAccessResults);
  }

  async getRadiologyImageFile(
    user: PatientJwtPayload,
    reportId: string,
    imageId: string,
  ) {
    const item = await this.prisma.radiologyOrderItem.findFirst({
      where: {
        id: reportId,
        ...this.patientItemWhere(user.sub),
      },
      select: {
        id: true,
        invoiceItemId: true,
        images: {
          where: { id: imageId },
          select: { id: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Radiology report "${reportId}" not found.`);
    }

    if (!item.images.length) {
      throw new NotFoundException(`Radiology image "${imageId}" not found.`);
    }

    const canAccessResults = await this.canPatientAccessResults(
      user.sub,
      item.invoiceItemId,
    );
    if (!canAccessResults) {
      throw new ForbiddenException(
        'Payment is required before viewing imaging files.',
      );
    }

    return this.radiologyImageService.getFile(imageId);
  }
}
