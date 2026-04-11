import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { LabOrderStatus, LabRequestStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceService } from '../../invoice/invoice.service';
import { invoiceLinkException } from '../../../common/exceptions/invoice-link.exception';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

@Injectable()
export class LabOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(dto: CreateLabOrderDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }
    const doctor = await this.prisma.staff.findUnique({
      where: { id: dto.doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor "${dto.doctorId}" not found.`);
    }

    const versionIds = dto.items.map((i) => i.testVersionId);
    const activeVersions = await this.prisma.labTestVersion.findMany({
      where: { id: { in: versionIds }, isActive: true },
    });
    if (activeVersions.length !== versionIds.length) {
      const foundIds = new Set(activeVersions.map((v) => v.id));
      const invalid = versionIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Only active test versions can be ordered. Invalid or inactive version(s): ${invalid.join(', ')}`,
      );
    }

    const orderInclude = {
      patient: {
        select: { id: true, firstName: true, surname: true, patientId: true },
      },
      doctor: {
        select: { id: true, firstName: true, lastName: true, staffId: true },
      },
      invoiceItem: {
        select: { id: true, invoiceId: true, serviceId: true },
      },
      items: {
        include: {
          testVersion: {
            include: {
              test: { select: { id: true, name: true, sampleType: true } },
            },
          },
        },
      },
    } as const;

    const hasInvoiceLink = !!(dto.invoiceId || dto.invoiceItemId || dto.serviceId);
    if (hasInvoiceLink) {
      if (!dto.invoiceId || !dto.invoiceItemId || !dto.serviceId) {
        throw invoiceLinkException(
          'INVALID_INVOICE_LINK_PAYLOAD',
          'invoiceId, invoiceItemId, and serviceId must all be provided together.',
        );
      }
      return this.prisma.$transaction(async (tx) => {
        await this.invoiceService.assertPaidInvoiceItemConsumable(tx, {
          invoiceId: dto.invoiceId!,
          invoiceItemId: dto.invoiceItemId!,
          serviceId: dto.serviceId!,
          patientId: dto.patientId,
          mode: 'lab',
        });
        const order = await tx.labOrder.create({
          data: {
            patientId: dto.patientId,
            doctorId: dto.doctorId,
            status: 'PENDING',
            invoiceItemId: dto.invoiceItemId!,
            items: {
              create: dto.items.map((item) => ({
                testVersionId: item.testVersionId,
                status: 'PENDING',
              })),
            },
          },
          include: orderInclude,
        });
        await tx.labRequest.updateMany({
          where: {
            invoiceItemId: dto.invoiceItemId!,
            status: { not: LabRequestStatus.CANCELLED },
          },
          data: { status: LabRequestStatus.COLLECTED },
        });
        return order;
      });
    }

    return this.prisma.labOrder.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        status: 'PENDING',
        items: {
          create: dto.items.map((item) => ({
            testVersionId: item.testVersionId,
            status: 'PENDING',
          })),
        },
      },
      include: orderInclude,
    });
  }

  async findAll(query: ListOrdersQueryDto) {
    const where: { patientId?: string; status?: LabOrderStatus } = {};
    if (query.patientId) where.patientId = query.patientId;
    if (query.status) where.status = query.status;

    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.labOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              patientId: true,
            },
          },
          doctor: { select: { id: true, firstName: true, lastName: true } },
          invoiceItem: {
            select: { id: true, invoiceId: true, serviceId: true },
          },
          items: {
            include: {
              testVersion: {
                include: { test: { select: { id: true, name: true } } },
              },
            },
          },
        },
      }),
      this.prisma.labOrder.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, firstName: true, surname: true, patientId: true },
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
        invoiceItem: {
          select: { id: true, invoiceId: true, serviceId: true },
        },
        items: {
          include: {
            testVersion: {
              include: {
                test: { select: { id: true, name: true, sampleType: true } },
                fields: { orderBy: { position: 'asc' } },
              },
            },
            sample: true,
            results: { include: { field: true } },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Lab order "${id}" not found.`);
    }
    return order;
  }

  async update(id: string, dto: UpdateLabOrderDto) {
    await this.findOne(id);
    const updated = await this.prisma.labOrder.update({
      where: { id },
      data: dto,
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        invoiceItem: {
          select: { id: true, invoiceId: true, serviceId: true },
        },
        items: {
          include: {
            testVersion: {
              include: { test: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (
      dto.status === LabOrderStatus.VERIFIED ||
      dto.status === LabOrderStatus.COMPLETED
    ) {
      await this.syncLabRequestCompletedForInvoiceItem(updated.invoiceItemId);
    }
    return updated;
  }

  private async syncLabRequestCompletedForInvoiceItem(
    invoiceItemId: string | null,
  ) {
    if (!invoiceItemId) return;
    await this.prisma.labRequest.updateMany({
      where: {
        invoiceItemId,
        status: { not: LabRequestStatus.CANCELLED },
      },
      data: { status: LabRequestStatus.COMPLETED },
    });
  }
}
