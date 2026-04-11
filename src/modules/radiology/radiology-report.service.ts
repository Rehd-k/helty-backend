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
    orderItemId: string,
    dto: CreateRadiologyReportDto,
    signedById: string,
  ) {
    const orderItem = await this.prisma.radiologyOrderItem.findUnique({
      where: { id: orderItemId },
      include: { report: true },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Radiology order item "${orderItemId}" not found.`,
      );
    }
    if (orderItem.report) {
      throw new BadRequestException(
        'This order item already has a report. Use PATCH to update.',
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
          radiologyOrderItemId: orderItemId,
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
      await tx.radiologyOrderItem.update({
        where: { id: orderItemId },
        data: { status: RadiologyRequestStatus.REPORTED },
      });
      await this.invoiceService.settleInvoiceItemIfPresent(
        tx,
        orderItem.invoiceItemId,
      );
      return report;
    });
  }

  async update(orderItemId: string, dto: UpdateRadiologyReportDto) {
    const orderItem = await this.prisma.radiologyOrderItem.findUnique({
      where: { id: orderItemId },
      include: { report: true },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Radiology order item "${orderItemId}" not found.`,
      );
    }
    if (!orderItem.report) {
      throw new NotFoundException(
        'No report for this order item. Use POST to create.',
      );
    }

    return this.prisma.radiologyStudyReport.update({
      where: { radiologyOrderItemId: orderItemId },
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

  async getByOrderItemId(orderItemId: string) {
    const report = await this.prisma.radiologyStudyReport.findUnique({
      where: { radiologyOrderItemId: orderItemId },
      include: {
        signedBy: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
        radiologyOrderItem: {
          select: {
            id: true,
            scanType: true,
            bodyPart: true,
            priority: true,
            order: {
              select: {
                patient: {
                  select: { firstName: true, surname: true, patientId: true },
                },
              },
            },
          },
        },
      },
    });
    if (!report) {
      throw new NotFoundException(
        `No report found for radiology order item "${orderItemId}".`,
      );
    }
    return report;
  }
}
