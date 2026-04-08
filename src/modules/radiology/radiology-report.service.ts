import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { CreateRadiologyReportDto } from './dto/radiology-report.dto';
import { UpdateRadiologyReportDto } from './dto/radiology-report.dto';
import { RadiologyRequestStatus } from '@prisma/client';

@Injectable()
export class RadiologyReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(
    requestId: string,
    dto: CreateRadiologyReportDto,
    signedById: string,
  ) {
    const request = await this.prisma.radiologyRequest.findUnique({
      where: { id: requestId },
      include: { report: true },
    });
    if (!request) {
      throw new NotFoundException(
        `Radiology request "${requestId}" not found.`,
      );
    }
    if (request.report) {
      throw new BadRequestException(
        'This request already has a report. Use PATCH to update.',
      );
    }
    const radiologist = await this.prisma.staff.findUnique({
      where: { id: signedById },
    });
    if (!radiologist) {
      throw new NotFoundException(`Staff "${signedById}" not found.`);
    }

    const signedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.radiologyStudyReport.create({
        data: {
          radiologyRequestId: requestId,
          findings: dto.findings ?? null,
          impression: dto.impression ?? null,
          recommendations: dto.recommendations ?? null,
          severity: dto.severity ?? null,
          signedById,
          signedAt,
        },
        include: {
          signedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      await tx.radiologyRequest.update({
        where: { id: requestId },
        data: { status: RadiologyRequestStatus.REPORTED },
      });
      await this.invoiceService.settleInvoiceItemIfPresent(
        tx,
        request.invoiceItemId,
      );
      return report;
    });
  }

  async update(requestId: string, dto: UpdateRadiologyReportDto) {
    const request = await this.prisma.radiologyRequest.findUnique({
      where: { id: requestId },
      include: { report: true },
    });
    if (!request) {
      throw new NotFoundException(
        `Radiology request "${requestId}" not found.`,
      );
    }
    if (!request.report) {
      throw new NotFoundException(
        'No report for this request. Use POST to create.',
      );
    }

    return this.prisma.radiologyStudyReport.update({
      where: { radiologyRequestId: requestId },
      data: {
        ...(dto.findings !== undefined && { findings: dto.findings }),
        ...(dto.impression !== undefined && { impression: dto.impression }),
        ...(dto.recommendations !== undefined && {
          recommendations: dto.recommendations,
        }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
      },
      include: {
        signedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getByRequestId(requestId: string) {
    const report = await this.prisma.radiologyStudyReport.findUnique({
      where: { radiologyRequestId: requestId },
      include: {
        signedBy: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
        radiologyRequest: {
          select: {
            id: true,
            patientId: true,
            scanType: true,
            bodyPart: true,
            priority: true,
            patient: {
              select: { firstName: true, surname: true, patientId: true },
            },
          },
        },
      },
    });
    if (!report) {
      throw new NotFoundException(
        `No report found for radiology request "${requestId}".`,
      );
    }
    return report;
  }
}
