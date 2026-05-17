import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RadiologyRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { invoiceLinkException } from '../../common/exceptions/invoice-link.exception';
import { CreateRadiologyRequestDto } from './dto/create-radiology-request.dto';
import { UpdateRadiologyRequestDto } from './dto/update-radiology-request.dto';
import { UpdateRadiologyOrderItemDto } from './dto/update-radiology-order-item.dto';
import { ListRadiologyRequestsQueryDto } from './dto/list-radiology-requests-query.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class RadiologyRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(dto: CreateRadiologyRequestDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }
    if (dto.encounterId) {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: dto.encounterId },
      });
      if (!encounter) {
        throw new NotFoundException(
          `Encounter "${dto.encounterId}" not found.`,
        );
      }
      if (encounter.patientId !== dto.patientId) {
        throw new BadRequestException(
          'Encounter does not belong to the given patient.',
        );
      }
    }
    const doctor = await this.prisma.staff.findUnique({
      where: { id: dto.requestedById },
    });
    if (!doctor) {
      throw new NotFoundException(`Staff "${dto.requestedById}" not found.`);
    }
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new NotFoundException(
          `Department "${dto.departmentId}" not found.`,
        );
      }
    }

    const orderInclude = {
      patient: {
        select: { id: true, firstName: true, surname: true, patientId: true },
      },
      encounter: { select: { id: true, encounterType: true, status: true } },
      requestedBy: {
        select: { id: true, firstName: true, lastName: true, staffId: true },
      },
      department: { select: { id: true, name: true } },
      items: {
        include: {
          invoiceItem: {
            select: {
              id: true,
              invoiceId: true,
              serviceId: true,
            },
          },
          schedule: true,
          procedure: true,
          report: true,
        },
      },
    } as const;

    type PreparedItem = {
      item: CreateRadiologyRequestDto['items'][number] & {
        invoiceId?: string;
        invoiceItemId?: string;
      };
      skipPaidInvoiceAssert: boolean;
    };

    const prepared: PreparedItem[] = [];
    for (const item of dto.items) {
      let resolved: PreparedItem['item'] = { ...item };
      let skipPaidInvoiceAssert = false;

      if (
        dto.encounterId &&
        item.serviceId &&
        !item.invoiceId &&
        !item.invoiceItemId
      ) {
        await this.invoiceService.assertServiceCategoryForEncounterBilling(
          item.serviceId,
          'radiology',
        );
        const { invoice, invoiceItemId } =
          await this.invoiceService.createWithServiceItem({
            patientId: dto.patientId,
            encounterId: dto.encounterId,
            staffId: dto.requestedById,
            serviceId: item.serviceId,
          });
        resolved = {
          ...resolved,
          invoiceId: invoice.id,
          invoiceItemId,
        };
        skipPaidInvoiceAssert = true;
      } else {
        const hasAll = !!(
          item.invoiceId &&
          item.invoiceItemId &&
          item.serviceId
        );
        const hasAny = !!(
          item.invoiceId ||
          item.invoiceItemId ||
          item.serviceId
        );
        if (hasAny && !hasAll) {
          throw invoiceLinkException(
            'INVALID_INVOICE_LINK_PAYLOAD',
            'invoiceId, invoiceItemId, and serviceId must all be provided together.',
          );
        }
      }

      prepared.push({ item: resolved, skipPaidInvoiceAssert });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const { item, skipPaidInvoiceAssert } of prepared) {
        if (
          item.invoiceId &&
          item.invoiceItemId &&
          item.serviceId &&
          !skipPaidInvoiceAssert
        ) {
          await this.invoiceService.assertPaidInvoiceItemConsumable(tx, {
            invoiceId: item.invoiceId,
            invoiceItemId: item.invoiceItemId,
            serviceId: item.serviceId,
            patientId: dto.patientId,
            mode: 'radiology',
          });
        }
      }
      return tx.radiologyOrder.create({
        data: {
          patientId: dto.patientId,
          encounterId: dto.encounterId ?? undefined,
          requestedById: dto.requestedById,
          departmentId: dto.departmentId ?? undefined,
          items: {
            create: prepared.map(({ item }) => ({
              clinicalNotes: item.clinicalNotes ?? null,
              reasonForInvestigation: item.reasonForInvestigation ?? null,
              priority: item.priority ?? 'ROUTINE',
              scanType: item.scanType,
              bodyPart: item.bodyPart ?? null,
              contrast: item.contrast ?? false,
              invoiceItemId: item.invoiceItemId ?? undefined,
            })),
          },
        },
        include: orderInclude,
      });
    });
  }

  async findAll(query: ListRadiologyRequestsQueryDto) {
    const {
      skip = 0,
      take = 20,
      encounterId,
      patientId,
      status,
      fromDate,
      toDate,
    } = query;
    const { from, to } = parseDateRange(fromDate, toDate);

    const where: Prisma.RadiologyOrderWhereInput = {};
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    if (encounterId) where.encounterId = encounterId;
    if (fromDate && toDate) where.createdAt = { gte: from, lte: to };

    const [requests, total] = await Promise.all([
      this.prisma.radiologyOrder.findMany({
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
          requestedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          items: {
            include: {
              schedule: true,
              report: { select: { id: true, signedAt: true } },
            },
          },
        },
      }),
      this.prisma.radiologyOrder.count({ where }),
    ]);

    return { requests, total, skip, take };
  }

  async findOne(id: string) {
    const request = await this.prisma.radiologyOrder.findUnique({
      where: { id },
      include: {
        patient: true,
        encounter: {
          select: {
            id: true,
            encounterType: true,
            status: true,
            startTime: true,
          },
        },
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
        department: { select: { id: true, name: true } },
        items: {
          include: {
            schedule: {
              include: {
                radiographer: {
                  select: { id: true, firstName: true, lastName: true },
                },
                machine: true,
              },
            },
            procedure: {
              include: {
                performedBy: {
                  select: { id: true, firstName: true, lastName: true },
                },
                machine: true,
              },
            },
            images: true,
            report: {
              include: {
                signedBy: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException(`Radiology order "${id}" not found.`);
    }
    return request;
  }

  async update(id: string, dto: UpdateRadiologyRequestDto) {
    const order = await this.prisma.radiologyOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            procedure: { select: { id: true } },
            report: { select: { id: true } },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Radiology order "${id}" not found.`);
    }

    if (dto.status === RadiologyRequestStatus.CANCELLED) {
      if (order.status === RadiologyRequestStatus.CANCELLED) {
        return this.findOne(id);
      }
      for (const item of order.items) {
        this.assertRadiologyOrderItemCancellable(item);
      }
      return this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          await this.invoiceService.removeBillableLineForEncounterRequest(
            item.invoiceItemId,
            tx,
          );
        }
        await tx.radiologyOrderItem.updateMany({
          where: { orderId: id },
          data: { status: RadiologyRequestStatus.CANCELLED },
        });
        return tx.radiologyOrder.update({
          where: { id },
          data: { status: RadiologyRequestStatus.CANCELLED },
          include: {
            patient: { select: { id: true, firstName: true, surname: true } },
            requestedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            items: true,
          },
        });
      });
    }

    return this.prisma.radiologyOrder.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });
  }

  async updateItem(
    orderId: string,
    itemId: string,
    dto: UpdateRadiologyOrderItemDto,
  ) {
    const item = await this.prisma.radiologyOrderItem.findFirst({
      where: { id: itemId, orderId },
      include: {
        procedure: { select: { id: true } },
        report: { select: { id: true } },
        order: { select: { id: true, status: true } },
      },
    });
    if (!item) {
      throw new NotFoundException(
        `Radiology order item "${itemId}" not found on order "${orderId}".`,
      );
    }

    if (dto.status === RadiologyRequestStatus.CANCELLED) {
      if (item.status === RadiologyRequestStatus.CANCELLED) {
        return this.findOne(orderId);
      }
      this.assertRadiologyOrderItemCancellable(item);
      return this.prisma.$transaction(async (tx) => {
        await this.invoiceService.removeBillableLineForEncounterRequest(
          item.invoiceItemId,
          tx,
        );
        await tx.radiologyOrderItem.update({
          where: { id: itemId },
          data: { status: RadiologyRequestStatus.CANCELLED },
        });
        await this.syncOrderStatusAfterItemChange(tx, orderId);
        return this.findOne(orderId);
      });
    }

    return this.prisma.radiologyOrderItem
      .update({
        where: { id: itemId },
        data: {
          ...(dto.status !== undefined && { status: dto.status }),
        },
      })
      .then(() => this.findOne(orderId));
  }

  async remove(id: string) {
    const order = await this.prisma.radiologyOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            procedure: { select: { id: true } },
            report: { select: { id: true } },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Radiology order "${id}" not found.`);
    }
    for (const item of order.items) {
      this.assertRadiologyOrderItemCancellable(item);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await this.invoiceService.removeBillableLineForEncounterRequest(
          item.invoiceItemId,
          tx,
        );
      }
      await tx.radiologyOrder.delete({ where: { id } });
    });
    return { message: 'Radiology order removed successfully.' };
  }

  async removeItem(orderId: string, itemId: string) {
    const item = await this.prisma.radiologyOrderItem.findFirst({
      where: { id: itemId, orderId },
      include: {
        procedure: { select: { id: true } },
        report: { select: { id: true } },
      },
    });
    if (!item) {
      throw new NotFoundException(
        `Radiology order item "${itemId}" not found on order "${orderId}".`,
      );
    }
    this.assertRadiologyOrderItemCancellable(item);

    await this.prisma.$transaction(async (tx) => {
      await this.invoiceService.removeBillableLineForEncounterRequest(
        item.invoiceItemId,
        tx,
      );
      await tx.radiologyOrderItem.delete({ where: { id: itemId } });
      const remaining = await tx.radiologyOrderItem.count({
        where: { orderId },
      });
      if (remaining === 0) {
        await tx.radiologyOrder.delete({ where: { id: orderId } });
      } else {
        await this.syncOrderStatusAfterItemChange(tx, orderId);
      }
    });

    const orderStillExists = await this.prisma.radiologyOrder.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!orderStillExists) {
      return { message: 'Radiology order item removed; order deleted (no items left).' };
    }
    return {
      message: 'Radiology order item removed successfully.',
      order: await this.findOne(orderId),
    };
  }

  private assertRadiologyOrderItemCancellable(item: {
    status: RadiologyRequestStatus;
    procedure: { id: string } | null;
    report: { id: string } | null;
  }) {
    if (item.status === RadiologyRequestStatus.CANCELLED) {
      return;
    }
    if (item.procedure || item.report) {
      throw new BadRequestException(
        'Cannot remove this imaging request: the study has already been performed or reported.',
      );
    }
    if (
      item.status === RadiologyRequestStatus.IN_PROGRESS ||
      item.status === RadiologyRequestStatus.COMPLETED ||
      item.status === RadiologyRequestStatus.REPORTED
    ) {
      throw new BadRequestException(
        `Cannot remove an imaging request with status ${item.status}.`,
      );
    }
  }

  private async syncOrderStatusAfterItemChange(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const items = await tx.radiologyOrderItem.findMany({
      where: { orderId },
      select: { status: true },
    });
    if (items.length === 0) return;

    const allCancelled = items.every(
      (i) => i.status === RadiologyRequestStatus.CANCELLED,
    );
    if (allCancelled) {
      await tx.radiologyOrder.update({
        where: { id: orderId },
        data: { status: RadiologyRequestStatus.CANCELLED },
      });
    }
  }
}
