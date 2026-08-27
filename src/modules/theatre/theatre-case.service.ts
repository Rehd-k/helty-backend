import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStatus,
  BedStatus,
  ConsumableUsageSource,
  Prisma,
  SurgeryRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { ConsumableUsageService } from '../store/consumable-usage.service';
import {
  AddCaseConsumableDto,
  BillSurgeryDto,
  TransferAfterSurgeryDto,
  UpdateTheatreCaseDto,
  UpsertTheatreOperativeNoteDto,
} from './dto/theatre.dto';
import { composeOperativeNoteSummary } from './operative-note.util';
import {
  surgeryRequestSummaryInclude,
  theatreCaseConsumableInclude,
  theatreOperativeNoteInclude,
} from './surgery-request-includes';

@Injectable()
export class TheatreCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly consumableUsage: ConsumableUsageService,
  ) {}

  private async getRequestOrThrow(surgeryRequestId: string) {
    const request = await this.prisma.surgeryRequest.findUnique({
      where: { id: surgeryRequestId },
      include: {
        case: true,
        schedule: true,
      },
    });
    if (!request) {
      throw new NotFoundException(
        `Surgery request "${surgeryRequestId}" not found.`,
      );
    }
    return request;
  }

  private async ensureCase(surgeryRequestId: string, performedById?: string) {
    const request = await this.getRequestOrThrow(surgeryRequestId);
    if (request.case) return request.case;

    return this.prisma.theatreCase.create({
      data: {
        surgeryRequestId,
        performedById: performedById ?? null,
      },
    });
  }

  async start(surgeryRequestId: string, staffId: string) {
    const request = await this.getRequestOrThrow(surgeryRequestId);
    if (request.status !== SurgeryRequestStatus.SCHEDULED) {
      throw new BadRequestException(
        'Only scheduled surgeries can be started.',
      );
    }
    if (!request.schedule) {
      throw new BadRequestException(
        'Surgery must be scheduled before starting.',
      );
    }

    const now = new Date();
    await this.ensureCase(surgeryRequestId, staffId);

    await this.prisma.surgeryRequest.update({
      where: { id: surgeryRequestId },
      data: { status: SurgeryRequestStatus.IN_PROGRESS },
    });

    return this.prisma.theatreCase.update({
      where: { surgeryRequestId },
      data: {
        startedAt: now,
        performedById: staffId,
      },
      include: {
        consumables: { include: theatreCaseConsumableInclude },
        staff: {
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                staffId: true,
              },
            },
          },
        },
      },
    });
  }

  async update(surgeryRequestId: string, dto: UpdateTheatreCaseDto) {
    await this.getRequestOrThrow(surgeryRequestId);
    const theatreCase = await this.ensureCase(
      surgeryRequestId,
      dto.performedById,
    );

    if (dto.performedById) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: dto.performedById },
      });
      if (!staff) {
        throw new NotFoundException(
          `Staff "${dto.performedById}" not found.`,
        );
      }
    }

    if (dto.team?.length) {
      for (const member of dto.team) {
        const staff = await this.prisma.staff.findUnique({
          where: { id: member.staffId },
        });
        if (!staff) {
          throw new NotFoundException(
            `Staff "${member.staffId}" not found.`,
          );
        }
      }

      for (const member of dto.team) {
        await this.prisma.theatreCaseStaff.upsert({
          where: {
            theatreCaseId_staffId_role: {
              theatreCaseId: theatreCase.id,
              staffId: member.staffId,
              role: member.role,
            },
          },
          create: {
            theatreCaseId: theatreCase.id,
            staffId: member.staffId,
            role: member.role,
          },
          update: {},
        });
      }
    }

    return this.prisma.theatreCase.update({
      where: { surgeryRequestId },
      data: {
        findings: dto.findings,
        complications: dto.complications,
        operativeNotes: dto.operativeNotes,
        performedById: dto.performedById,
      },
      include: {
        consumables: { include: theatreCaseConsumableInclude },
        staff: {
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                staffId: true,
              },
            },
          },
        },
      },
    });
  }

  private assertOperativeNotesWritable(status: SurgeryRequestStatus) {
    if (
      status !== SurgeryRequestStatus.IN_PROGRESS &&
      status !== SurgeryRequestStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Operative notes can only be added while surgery is in progress or completed.',
      );
    }
  }

  private async syncCaseSummaryFromLatestNote(theatreCaseId: string) {
    const latest = await this.prisma.theatreOperativeNote.findFirst({
      where: { theatreCaseId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) return;

    const summary = composeOperativeNoteSummary(latest);
    await this.prisma.theatreCase.update({
      where: { id: theatreCaseId },
      data: {
        operativeNotes: summary.operativeNotes,
        ...(summary.findings != null ? { findings: summary.findings } : {}),
        ...(summary.complications != null
          ? { complications: summary.complications }
          : {}),
      },
    });
  }

  async listOperativeNotes(surgeryRequestId: string) {
    const request = await this.getRequestOrThrow(surgeryRequestId);
    if (!request.case) return [];
    return this.prisma.theatreOperativeNote.findMany({
      where: { theatreCaseId: request.case.id },
      include: theatreOperativeNoteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOperativeNote(
    surgeryRequestId: string,
    dto: UpsertTheatreOperativeNoteDto,
    staffId: string,
  ) {
    const request = await this.getRequestOrThrow(surgeryRequestId);
    this.assertOperativeNotesWritable(request.status);
    const theatreCase = await this.ensureCase(surgeryRequestId, staffId);

    const note = await this.prisma.theatreOperativeNote.create({
      data: {
        theatreCaseId: theatreCase.id,
        authoredById: staffId,
        schemaVersion: dto.schemaVersion ?? 1,
        answersJson: dto.answersJson as Prisma.InputJsonValue,
        narrative: dto.narrative ?? '',
        additionalNotes: dto.additionalNotes?.trim()
          ? dto.additionalNotes.trim()
          : null,
      },
      include: theatreOperativeNoteInclude,
    });

    await this.syncCaseSummaryFromLatestNote(theatreCase.id);
    return note;
  }

  async updateOperativeNote(
    surgeryRequestId: string,
    noteId: string,
    dto: UpsertTheatreOperativeNoteDto,
    staffId: string,
  ) {
    const request = await this.getRequestOrThrow(surgeryRequestId);
    this.assertOperativeNotesWritable(request.status);
    const theatreCase = await this.ensureCase(surgeryRequestId, staffId);

    const existing = await this.prisma.theatreOperativeNote.findFirst({
      where: { id: noteId, theatreCaseId: theatreCase.id },
    });
    if (!existing) {
      throw new NotFoundException(`Operative note "${noteId}" not found.`);
    }

    const note = await this.prisma.theatreOperativeNote.update({
      where: { id: noteId },
      data: {
        updatedById: staffId,
        schemaVersion: dto.schemaVersion ?? existing.schemaVersion,
        answersJson: dto.answersJson as Prisma.InputJsonValue,
        narrative: dto.narrative ?? '',
        additionalNotes: dto.additionalNotes?.trim()
          ? dto.additionalNotes.trim()
          : null,
      },
      include: theatreOperativeNoteInclude,
    });

    await this.syncCaseSummaryFromLatestNote(theatreCase.id);
    return note;
  }

  async complete(surgeryRequestId: string) {
    const request = await this.getRequestOrThrow(surgeryRequestId);
    if (request.status !== SurgeryRequestStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Only in-progress surgeries can be completed.',
      );
    }

    const now = new Date();
    await this.ensureCase(surgeryRequestId);

    await this.prisma.surgeryRequest.update({
      where: { id: surgeryRequestId },
      data: { status: SurgeryRequestStatus.COMPLETED },
    });

    return this.prisma.theatreCase.update({
      where: { surgeryRequestId },
      data: { endedAt: now },
      include: {
        consumables: { include: theatreCaseConsumableInclude },
        staff: {
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                staffId: true,
              },
            },
          },
        },
      },
    });
  }

  private async resolveConsumableUnitPrice(
    consumableId: string,
    storeLocationId: string,
  ): Promise<number> {
    const batch = await this.prisma.consumableBatch.findFirst({
      where: {
        consumableId,
        storeLocationId,
        quantityRemaining: { gt: 0 },
      },
      orderBy: { expiryDate: 'asc' },
      select: { sellingPrice: true },
    });
    if (!batch) {
      throw new BadRequestException(
        'No available stock batch found for this consumable at the selected store location.',
      );
    }
    return Number(batch.sellingPrice);
  }

  async addConsumable(
    surgeryRequestId: string,
    dto: AddCaseConsumableDto,
    staffId: string,
  ) {
    const request = await this.getRequestOrThrow(surgeryRequestId);
    if (
      request.status !== SurgeryRequestStatus.IN_PROGRESS &&
      request.status !== SurgeryRequestStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Consumables can only be added during or after surgery.',
      );
    }

    const theatreCase = await this.ensureCase(surgeryRequestId, staffId);
    const billable = dto.billable !== false;
    const quantity = dto.quantity;
    const unitPrice =
      dto.unitPrice ??
      (billable
        ? await this.resolveConsumableUnitPrice(
            dto.consumableId,
            dto.storeLocationId,
          )
        : 0);

    if (!billable) {
      const usageEvent = await this.consumableUsage.recordNonBillableUse(
        {
          consumableId: dto.consumableId,
          storeLocationId: dto.storeLocationId,
          patientId: request.patientId,
          encounterId: request.encounterId,
          admissionId: request.admissionId ?? undefined,
          source: ConsumableUsageSource.THEATRE,
          quantity,
        },
        staffId,
      );

      return this.prisma.theatreCaseConsumable.create({
        data: {
          theatreCaseId: theatreCase.id,
          consumableId: dto.consumableId,
          storeLocationId: dto.storeLocationId,
          quantity,
          unitPrice,
          billable: false,
          usageEventId: usageEvent.id,
          createdById: staffId,
        },
        include: theatreCaseConsumableInclude,
      });
    }

    return this.prisma.theatreCaseConsumable.create({
      data: {
        theatreCaseId: theatreCase.id,
        consumableId: dto.consumableId,
        storeLocationId: dto.storeLocationId,
        quantity,
        unitPrice,
        billable: true,
        createdById: staffId,
      },
      include: theatreCaseConsumableInclude,
    });
  }

  async removeConsumable(
    surgeryRequestId: string,
    consumableLineId: string,
  ) {
    const request = await this.getRequestOrThrow(surgeryRequestId);
    if (request.status === SurgeryRequestStatus.BILLED) {
      throw new BadRequestException(
        'Cannot remove consumables after billing.',
      );
    }

    const line = await this.prisma.theatreCaseConsumable.findFirst({
      where: {
        id: consumableLineId,
        theatreCase: { surgeryRequestId },
      },
    });
    if (!line) {
      throw new NotFoundException('Consumable line not found.');
    }
    if (line.invoiceItemId) {
      throw new BadRequestException(
        'Cannot remove a consumable that has already been billed.',
      );
    }

    await this.prisma.theatreCaseConsumable.delete({
      where: { id: consumableLineId },
    });

    return { deleted: true };
  }

  async bill(
    surgeryRequestId: string,
    dto: BillSurgeryDto,
    staffId: string,
  ) {
    const request = await this.prisma.surgeryRequest.findUnique({
      where: { id: surgeryRequestId },
      include: {
        case: {
          include: {
            consumables: {
              where: { billable: true, invoiceItemId: null },
            },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException(
        `Surgery request "${surgeryRequestId}" not found.`,
      );
    }
    if (request.status === SurgeryRequestStatus.BILLED) {
      throw new BadRequestException('Surgery has already been billed.');
    }
    if (request.status !== SurgeryRequestStatus.COMPLETED) {
      throw new BadRequestException(
        'Surgery must be completed before billing.',
      );
    }
    if (request.invoiceItemId) {
      throw new BadRequestException('Surgery service has already been billed.');
    }

    const billingStaffId = dto.billedByStaffId ?? staffId;

    return this.prisma.$transaction(async (tx) => {
      const { invoice, invoiceItemId } =
        await this.invoiceService.createWithServiceItem({
          patientId: request.patientId,
          encounterId: request.encounterId,
          staffId: billingStaffId,
          serviceId: request.serviceId,
        });

      await tx.surgeryRequest.update({
        where: { id: surgeryRequestId },
        data: {
          invoiceId: invoice.id,
          invoiceItemId,
          status: SurgeryRequestStatus.BILLED,
        },
      });

      for (const consumable of request.case?.consumables ?? []) {
        const item = await this.invoiceService.addItem(
          invoice.id,
          {
            consumableId: consumable.consumableId,
            storeLocationId: consumable.storeLocationId,
            quantity: consumable.quantity,
            unitPrice: Number(consumable.unitPrice),
          },
          billingStaffId,
        );

        await tx.theatreCaseConsumable.update({
          where: { id: consumable.id },
          data: {
            invoiceId: invoice.id,
            invoiceItemId: item.id,
          },
        });
      }

      return tx.surgeryRequest.findUniqueOrThrow({
        where: { id: surgeryRequestId },
        include: surgeryRequestSummaryInclude,
      });
    });
  }

  async transfer(
    surgeryRequestId: string,
    dto: TransferAfterSurgeryDto,
    staffId: string,
  ) {
    const request = await this.getRequestOrThrow(surgeryRequestId);
    if (!request.admissionId) {
      throw new BadRequestException(
        'Transfer requires an inpatient admission linked to the surgery request.',
      );
    }
    if (request.admissionId !== dto.admissionId) {
      throw new BadRequestException(
        'Admission does not match the surgery request.',
      );
    }

    const admission = await this.prisma.admission.findUnique({
      where: { id: dto.admissionId },
      include: { bed: true },
    });
    if (!admission || admission.dischargeDate) {
      throw new BadRequestException('Active admission not found.');
    }

    const ward = await this.prisma.ward.findUnique({
      where: { id: dto.wardId },
    });
    if (!ward) {
      throw new NotFoundException(`Ward "${dto.wardId}" not found.`);
    }

    const bed = await this.prisma.bed.findUnique({
      where: { id: dto.bedId },
    });
    if (!bed || bed.wardId !== dto.wardId) {
      throw new BadRequestException(
        'Bed not found or does not belong to the selected ward.',
      );
    }
    if (bed.status !== BedStatus.AVAILABLE && bed.id !== admission.bedId) {
      throw new BadRequestException('Selected bed is not available.');
    }

    const previousBedId = admission.bedId;

    await this.prisma.$transaction(async (tx) => {
      if (previousBedId && previousBedId !== dto.bedId) {
        await tx.bed.update({
          where: { id: previousBedId },
          data: { status: BedStatus.AVAILABLE },
        });
      }

      await tx.bed.update({
        where: { id: dto.bedId },
        data: { status: BedStatus.OCCUPIED },
      });

      await tx.admission.update({
        where: { id: dto.admissionId },
        data: {
          wardId: dto.wardId,
          bedId: dto.bedId,
          ward: ward.name,
          status: AdmissionStatus.TRANSFERRED,
          updatedById: staffId,
        },
      });

      await tx.patient.update({
        where: { id: admission.patientId },
        data: {
          wardId: dto.wardId,
          updatedById: staffId,
        },
      });

      const theatreCase = await tx.theatreCase.findUnique({
        where: { surgeryRequestId },
      });
      if (theatreCase) {
        await tx.theatreCase.update({
          where: { id: theatreCase.id },
          data: { transferNotes: dto.transferNotes ?? null },
        });
      }
    });

    return this.prisma.surgeryRequest.findUniqueOrThrow({
      where: { id: surgeryRequestId },
      include: surgeryRequestSummaryInclude,
    });
  }
}
