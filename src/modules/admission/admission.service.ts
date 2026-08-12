import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAdmissionDto,
  UpdateAdmissionDto,
} from './dto/create-admission.dto';
import {
  AdmissionStatus,
  EncounterStatus,
  InvoiceCoverageStatus,
  InvoiceStatus,
  PatientStatus,
  Prisma,
} from '@prisma/client';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import { InvoiceService } from '../invoice/invoice.service';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

const ADMISSION_UPDATE_INCLUDE = {
  updatedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  patient: true,
  wardEntity: true,
  bed: true,
  encounter: true,
  clinicallyDischargedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  billingClearedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  nursesClearedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

@Injectable()
export class AdmissionService {
  constructor(
    private prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) { }

  /** Ward whose trimmed name is `OPD` (same rule as `PatientService`). */
  private async resolveOpdWardId(
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const wards = await client.ward.findMany({
      select: { id: true, name: true },
    });
    const opd = wards.find((w) => w.name?.trim().toUpperCase() === 'OPD');
    if (!opd) {
      throw new BadRequestException(
        'No ward named "OPD" exists. Create it before discharging a patient to outpatient.',
      );
    }
    return opd.id;
  }

  private asDecimal(
    v: Prisma.Decimal | number | string | null | undefined,
  ): Prisma.Decimal {
    if (v === null || v === undefined) return new Prisma.Decimal(0);
    if (v instanceof Prisma.Decimal) return v;
    return new Prisma.Decimal(v);
  }

  private admissionInvoiceConditions(
    admissionId: string,
    encounterId?: string | null,
  ): Prisma.InvoiceWhereInput[] {
    const conditions: Prisma.InvoiceWhereInput[] = [
      { encounter: { admissionId } },
    ];
    if (encounterId) {
      conditions.push({ encounterId });
    }
    return conditions;
  }

  private async getAdmissionInvoices(
    tx: Prisma.TransactionClient,
    admission: { id: string; patientId: string; encounter?: { id: string } | null },
  ) {
    return tx.invoice.findMany({
      where: {
        patientId: admission.patientId,
        OR: this.admissionInvoiceConditions(
          admission.id,
          admission.encounter?.id,
        ),
      },
    });
  }

  private async invoiceCoveredAmountsByInvoiceId(
    tx: Prisma.TransactionClient,
    invoiceIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    const coveredByInvoiceId = new Map<string, Prisma.Decimal>(
      invoiceIds.map((id) => [id, new Prisma.Decimal(0)]),
    );
    if (!invoiceIds.length) return coveredByInvoiceId;

    const rows = await tx.invoiceCoverage.groupBy({
      by: ['invoiceId'],
      where: {
        invoiceId: { in: invoiceIds },
        status: { not: InvoiceCoverageStatus.REVERSED },
      },
      _sum: { amount: true },
    });
    for (const row of rows) {
      coveredByInvoiceId.set(
        row.invoiceId,
        this.asDecimal(row._sum.amount ?? 0),
      );
    }
    return coveredByInvoiceId;
  }

  private invoiceOutstandingBalance(
    invoice: {
      totalAmount: Prisma.Decimal;
      amountPaid: Prisma.Decimal;
    },
    coveredAmount: Prisma.Decimal,
  ): Prisma.Decimal {
    const balance = this.asDecimal(invoice.totalAmount)
      .sub(this.asDecimal(invoice.amountPaid))
      .sub(coveredAmount);
    return balance.gt(0) ? balance : new Prisma.Decimal(0);
  }

  private async recalculateInvoiceTotalsForDischarge(
    invoiceId: string,
    now: Date = new Date(),
    tx: Prisma.TransactionClient = this.prisma,
    updatedByStaffId?: string,
  ) {
    const updated = await this.invoiceService.recalculateInvoiceTotals(
      invoiceId,
      tx,
      now,
    );
    if (updatedByStaffId) {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { updatedById: updatedByStaffId },
      });
    }
    return updated;
  }

  private async areAllAdmissionInvoicesPaid(
    tx: Prisma.TransactionClient,
    invoiceIds: string[],
  ): Promise<boolean> {
    if (!invoiceIds.length) return true;

    const invoices = await tx.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: { id: true, totalAmount: true, amountPaid: true },
    });
    const coveredByInvoiceId = await this.invoiceCoveredAmountsByInvoiceId(
      tx,
      invoiceIds,
    );

    return invoices.every(
      (invoice) =>
        this.invoiceOutstandingBalance(
          invoice,
          coveredByInvoiceId.get(invoice.id) ?? new Prisma.Decimal(0),
        ).lte(0),
    );
  }

  private buildBillingSummary(
    invoices: Array<{
      id: string;
      invoiceID: string;
      status: InvoiceStatus;
      totalAmount: Prisma.Decimal;
      amountPaid: Prisma.Decimal;
    }>,
    coveredByInvoiceId: Map<string, Prisma.Decimal>,
  ) {
    let totalBalance = new Prisma.Decimal(0);
    const rows = invoices.map((invoice) => {
      const total = this.asDecimal(invoice.totalAmount);
      const paid = this.asDecimal(invoice.amountPaid);
      const covered = coveredByInvoiceId.get(invoice.id) ?? new Prisma.Decimal(0);
      const balance = this.invoiceOutstandingBalance(invoice, covered);
      if (balance.gt(0)) {
        totalBalance = totalBalance.add(balance);
      }
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceID,
        status: invoice.status,
        totalAmount: total.toFixed(2),
        amountPaid: paid.toFixed(2),
        coveredAmount: covered.toFixed(2),
        balance: balance.toFixed(2),
      };
    });
    return {
      invoices: rows,
      totalBalance: totalBalance.toFixed(2),
      allPaid: totalBalance.lte(0),
    };
  }

  private async closeUsageSegmentsForDischarge(
    tx: Prisma.TransactionClient,
    invoiceIds: string[],
    dischargedAt: Date,
  ) {
    if (!invoiceIds.length) return;
    await tx.invoiceItemUsageSegment.updateMany({
      where: {
        endAt: null,
        invoiceItem: {
          invoice: { id: { in: invoiceIds } },
        },
      },
      data: { endAt: dischargedAt },
    });
  }

  private async finalizeAdmission(
    tx: Prisma.TransactionClient,
    params: {
      admissionId: string;
      patientId: string;
      outcome: string;
      staffId: string;
      billingClearedById?: string;
      nursesClearedById?: string;
      billingClearedAt?: Date | null;
      nursesClearedAt?: Date | null;
    },
  ) {
    const isDeath = params.outcome === 'Death';
    const clearedAt = new Date();

    if (isDeath) {
      await tx.patient.update({
        where: { id: params.patientId },
        data: {
          wardId: null,
          status: PatientStatus.DECEASED,
          updatedById: params.staffId,
        },
      });
    } else {
      const opdWardId = await this.resolveOpdWardId(tx);
      await tx.patient.update({
        where: { id: params.patientId },
        data: {
          wardId: opdWardId,
          status: PatientStatus.OUTPATIENT,
          updatedById: params.staffId,
        },
      });
    }

    return tx.admission.update({
      where: { id: params.admissionId },
      data: {
        status: isDeath ? AdmissionStatus.DECEASED : AdmissionStatus.DISCHARGED,
        updatedById: params.staffId,
        billingClearedById:
          params.billingClearedById ?? undefined,
        billingClearedAt: params.billingClearedById
          ? (params.billingClearedAt ?? clearedAt)
          : undefined,
        nursesClearedById: params.nursesClearedById ?? undefined,
        nursesClearedAt: params.nursesClearedById
          ? (params.nursesClearedAt ?? clearedAt)
          : undefined,
      },
      include: ADMISSION_UPDATE_INCLUDE,
    });
  }

  private async tryFinalizePendingClearance(
    tx: Prisma.TransactionClient,
    admission: {
      id: string;
      patientId: string;
      outcome: string | null;
      billingClearedAt: Date | null;
      nursesClearedAt: Date | null;
    },
    staffId: string,
  ) {
    if (!admission.outcome) {
      throw new BadRequestException(
        'Admission has no discharge outcome recorded.',
      );
    }
    if (!admission.billingClearedAt || !admission.nursesClearedAt) {
      return tx.admission.findUniqueOrThrow({
        where: { id: admission.id },
        include: ADMISSION_UPDATE_INCLUDE,
      });
    }
    return this.finalizeAdmission(tx, {
      admissionId: admission.id,
      patientId: admission.patientId,
      outcome: admission.outcome,
      staffId,
    });
  }

  private async recordWardHistory(
    tx: Prisma.TransactionClient,
    params: {
      admissionId: string;
      fromWardId?: string | null;
      toWardId?: string | null;
      fromBedId?: string | null;
      toBedId?: string | null;
      changedById: string;
      reason?: string | null;
    },
  ) {
    if (
      params.fromWardId === params.toWardId &&
      params.fromBedId === params.toBedId
    ) {
      return;
    }
    await tx.admissionWardHistory.create({
      data: {
        admissionId: params.admissionId,
        fromWardId: params.fromWardId ?? null,
        toWardId: params.toWardId ?? null,
        fromBedId: params.fromBedId ?? null,
        toBedId: params.toBedId ?? null,
        changedById: params.changedById,
        reason: params.reason ?? null,
      },
    });
  }

  async create(
    createAdmissionDto: CreateAdmissionDto,
    req: { user: { sub: string } },
  ) {
    const [patient, encounter] = await Promise.all([
      this.prisma.patient.findUnique({
        where: { id: createAdmissionDto.patientId },
      }),
      this.prisma.encounter.findUnique({
        where: { id: createAdmissionDto.encounterId },
      }),
    ]);

    if (!patient) {
      throw new NotFoundException(
        `Patient "${createAdmissionDto.patientId}" not found.`,
      );
    }
    if (!encounter) {
      throw new NotFoundException(
        `Encounter "${createAdmissionDto.encounterId}" not found.`,
      );
    }
    if (encounter.patientId !== createAdmissionDto.patientId) {
      throw new BadRequestException(
        'Encounter does not belong to the given patient.',
      );
    }
    if (encounter.admissionId) {
      throw new BadRequestException(
        'This encounter is already linked to an admission. One encounter can only have one admission.',
      );
    }

    const admission = await this.prisma.admission.create({
      data: {
        patientId: createAdmissionDto.patientId,
        admissionDate: new Date(Date.now()),
        dischargeDate: createAdmissionDto.dischargeDate
          ? new Date(createAdmissionDto.dischargeDate)
          : null,
        bedId: createAdmissionDto.bedId,
        wardId: createAdmissionDto.wardId,
        ward: createAdmissionDto.ward,
        room: createAdmissionDto.room,
        reason: createAdmissionDto.reason,
        createdById: req.user.sub,
        ...(createAdmissionDto.attendingDoctorId && {
          attendingDoctorId: createAdmissionDto.attendingDoctorId,
        }),
      },
    });

    await this.prisma.encounter.update({
      where: { id: createAdmissionDto.encounterId },
      data: {
        admissionId: admission.id,
        status: EncounterStatus.COMPLETED,
        updatedById: req.user.sub,
      },
    });

    await this.prisma.patient.update({
      where: { id: createAdmissionDto.patientId },
      data: {
        status: PatientStatus.ADMITED,
        wardId: createAdmissionDto.wardId ?? null,
        updatedById: req.user.sub,
      },
    });

    await this.prisma.admissionWardHistory.create({
      data: {
        admissionId: admission.id,
        fromWardId: null,
        toWardId: createAdmissionDto.wardId ?? null,
        fromBedId: null,
        toBedId: createAdmissionDto.bedId ?? null,
        changedById: req.user.sub,
        reason: 'Admission',
      },
    });

    return this.prisma.admission.findUnique({
      where: { id: admission.id },
      include: {
        patient: true,
        wardEntity: true,
        bed: true,
        encounter: true,
      },
    });
  }

  async findAll(
    skip = 0,
    take = 10,
    filters?: { status?: string; attendingDoctorId?: string },
  ) {
    const statusValue =
      filters?.status === 'admitted' ? 'ACTIVE' : filters?.status;
    const where: any = {};
    if (statusValue) where.status = statusValue;
    if (filters?.attendingDoctorId)
      where.attendingDoctorId = filters.attendingDoctorId;

    const [admissions, total] = await Promise.all([
      this.prisma.admission.findMany({
        where,
        skip,
        take,
        include: {
          patient: {
            include: {
              admissions: true,
              createdBy: true,
              updatedBy: true,
            },
          },
          wardEntity: true,
          bed: true,
          encounter: true,
          createdBy: { select: staffBriefSelect },
        },
        orderBy: { admissionDate: 'desc' },
      }),
      this.prisma.admission.count({ where }),
    ]);

    return { admissions, total, skip, take };
  }

  async findPendingBillingClearance(skip = 0, take = 20) {
    const where = {
      status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
      billingClearedAt: null,
    };

    const [admissions, total] = await Promise.all([
      this.prisma.admission.findMany({
        where,
        skip,
        take,
        orderBy: { dischargeDateTime: 'asc' },
        include: {
          wardEntity: { select: { id: true, name: true } },
          bed: { select: { bedNumber: true } },
          attendingDoctor: {
            select: { id: true, firstName: true, lastName: true, staffId: true },
          },
          clinicallyDischargedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          patient: {
            select: {
              ...patientNameFieldsSelect,
              phoneNumber: true,
            },
          },
          encounter: { select: { id: true } },
          createdBy: { select: staffBriefSelect },
        },
      }),
      this.prisma.admission.count({ where }),
    ]);

    const rows = await Promise.all(
      admissions.map(async (admission) => {
        const invoices = await this.getAdmissionInvoices(this.prisma, admission);
        const coveredByInvoiceId = await this.invoiceCoveredAmountsByInvoiceId(
          this.prisma,
          invoices.map((invoice) => invoice.id),
        );
        return {
          id: admission.id,
          admissionDate: admission.admissionDate,
          dischargeDateTime: admission.dischargeDateTime,
          outcome: admission.outcome,
          dischargeSummary: admission.dischargeSummary,
          room: admission.room,
          wardEntity: admission.wardEntity,
          bed: admission.bed,
          attendingDoctor: admission.attendingDoctor,
          clinicallyDischargedBy: admission.clinicallyDischargedBy,
          patient: admission.patient,
          createdBy: admission.createdBy,
          billing: this.buildBillingSummary(invoices, coveredByInvoiceId),
        };
      }),
    );

    return { admissions: rows, total, skip, take };
  }

  async clearBillingClearance(admissionId: string, staffId: string) {
    return this.prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findUnique({
        where: { id: admissionId },
        include: { encounter: true },
      });
      if (!admission) {
        throw new NotFoundException('Admission not found');
      }
      if (admission.status !== AdmissionStatus.PENDING_BILLING_CLEARANCE) {
        throw new BadRequestException(
          'Admission is not awaiting billing clearance.',
        );
      }
      if (!admission.outcome) {
        throw new BadRequestException(
          'Admission has no discharge outcome recorded.',
        );
      }
      if (admission.billingClearedAt) {
        throw new BadRequestException('Billing clearance already recorded.');
      }

      const invoices = await this.getAdmissionInvoices(tx, admission);
      const invoiceIds = invoices.map((invoice) => invoice.id);
      const coveredByInvoiceId = await this.invoiceCoveredAmountsByInvoiceId(
        tx,
        invoiceIds,
      );
      const allPaid = await this.areAllAdmissionInvoicesPaid(tx, invoiceIds);
      if (!allPaid) {
        throw new BadRequestException({
          message:
            'Cannot clear billing while linked invoices are unpaid. Record payments first.',
          billing: this.buildBillingSummary(invoices, coveredByInvoiceId),
        });
      }

      const clearedAt = new Date();
      const updated = await tx.admission.update({
        where: { id: admission.id },
        data: {
          billingClearedAt: clearedAt,
          billingClearedById: staffId,
          updatedById: staffId,
        },
        include: ADMISSION_UPDATE_INCLUDE,
      });

      return this.tryFinalizePendingClearance(
        tx,
        {
          id: updated.id,
          patientId: updated.patientId,
          outcome: updated.outcome,
          billingClearedAt: updated.billingClearedAt,
          nursesClearedAt: updated.nursesClearedAt,
        },
        staffId,
      );
    });
  }

  async clearNursesClearance(admissionId: string, staffId: string) {
    return this.prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findUnique({
        where: { id: admissionId },
      });
      if (!admission) {
        throw new NotFoundException('Admission not found');
      }
      if (admission.status !== AdmissionStatus.PENDING_BILLING_CLEARANCE) {
        throw new BadRequestException(
          'Admission is not awaiting discharge clearance.',
        );
      }
      if (!admission.outcome) {
        throw new BadRequestException(
          'Admission has no discharge outcome recorded.',
        );
      }
      if (admission.nursesClearedAt) {
        throw new BadRequestException('Nurses clearance already recorded.');
      }

      const clearedAt = new Date();
      const updated = await tx.admission.update({
        where: { id: admission.id },
        data: {
          nursesClearedAt: clearedAt,
          nursesClearedById: staffId,
          updatedById: staffId,
        },
        include: ADMISSION_UPDATE_INCLUDE,
      });

      return this.tryFinalizePendingClearance(
        tx,
        {
          id: updated.id,
          patientId: updated.patientId,
          outcome: updated.outcome,
          billingClearedAt: updated.billingClearedAt,
          nursesClearedAt: updated.nursesClearedAt,
        },
        staffId,
      );
    });
  }

  async findPendingNursesClearance(skip = 0, take = 20) {
    const where = {
      status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
      nursesClearedAt: null,
    };
    const [admissions, total] = await Promise.all([
      this.prisma.admission.findMany({
        where,
        skip,
        take,
        orderBy: { dischargeDateTime: 'asc' },
        include: {
          wardEntity: { select: { id: true, name: true } },
          bed: { select: { bedNumber: true } },
          attendingDoctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffId: true,
            },
          },
          clinicallyDischargedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          billingClearedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          patient: {
            select: {
              ...patientNameFieldsSelect,
              phoneNumber: true,
            },
          },
          encounter: { select: { id: true } },
          createdBy: { select: staffBriefSelect },
        },
      }),
      this.prisma.admission.count({ where }),
    ]);

    const rows = await Promise.all(
      admissions.map(async (admission) => {
        const invoices = await this.getAdmissionInvoices(this.prisma, admission);
        const coveredByInvoiceId = await this.invoiceCoveredAmountsByInvoiceId(
          this.prisma,
          invoices.map((invoice) => invoice.id),
        );
        return {
          id: admission.id,
          patientId: admission.patientId,
          status: admission.status,
          admissionDate: admission.admissionDate,
          dischargeDateTime: admission.dischargeDateTime,
          outcome: admission.outcome,
          dischargeSummary: admission.dischargeSummary,
          room: admission.room,
          primaryDiagnosis: admission.primaryDiagnosis,
          wardEntity: admission.wardEntity,
          bed: admission.bed,
          attendingDoctor: admission.attendingDoctor,
          clinicallyDischargedBy: admission.clinicallyDischargedBy,
          billingClearedAt: admission.billingClearedAt,
          billingClearedBy: admission.billingClearedBy,
          nursesClearedAt: admission.nursesClearedAt,
          patient: admission.patient,
          createdBy: admission.createdBy,
          billing: this.buildBillingSummary(invoices, coveredByInvoiceId),
        };
      }),
    );

    return { admissions: rows, total, skip, take };
  }

  async findOne(id: string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id },
      include: {
        patient: {
          select: patientNameFieldsSelect,
        },
        wardEntity: {
          select: {
            id: true,
            name: true,
          },
        },
        bed: true,
        encounter: {
          select: {
            id: true,
            medicationOrders: true,
          },
        },
        patientVitals: {
          include: {
            nurse: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        medicationOrders: {
          include: {
            doctor: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        nurseAssignments: {
          include: {
            nurse: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                staffRole: true,
              },
            },
          },
        },
        medicationAdministrations: {
          include: {
            medicationOrder: {
              select: {
                id: true,
                drugName: true,
                dose: true,
                route: true,
                frequency: true,
                status: true,
              },
            },
            nurse: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                staffRole: true,
              },
            },
          },
        },
        ivFluidOrders: true,
        ivMonitorings: true,
        intakeOutputRecords: true,
        nursingNotes: true,
        procedureRecords: true,
        woundAssessments: true,
        carePlans: true,
        monitoringCharts: true,
        handoverReports: true,
        admittedByDoctor: true,
        alerts: true,
        auditTrails: true,
        wardRoundNotes: true,
        labourDeliveries: true,
        gynaeProcedures: true,
        attendingDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffId: true,
          },
        },
        clinicallyDischargedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        billingClearedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        nursesClearedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        wardHistory: {
          orderBy: { changedAt: 'asc' },
          include: {
            fromWard: { select: { id: true, name: true } },
            toWard: { select: { id: true, name: true } },
            changedBy: { select: staffBriefSelect },
          },
        },
        createdBy: {
          select: staffBriefSelect,
        },
      },
    });

    if (!admission) {
      throw new NotFoundException('Admission not found');
    }
    return admission;
  }

  async findByPatientId(patientId: string) {
    return this.prisma.admission.findMany({
      where: { patientId },
      orderBy: { admissionDate: 'desc' },
      include: {
        patient: true,
        encounter: true,
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  async getActiveAdmissions() {
    return this.prisma.admission.findMany({
      where: {
        dischargeDate: null,
      },
      include: {
        patient: true,
        encounter: true,
        createdBy: { select: staffBriefSelect },
      },
      orderBy: { admissionDate: 'asc' },
    });
  }

  async update(
    id: string,
    updateAdmissionDto: UpdateAdmissionDto,
    staffId: string,
  ) {
    if (!updateAdmissionDto.dischargeDate) {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.admission.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Admission not found');

        const nextWardId =
          updateAdmissionDto.wardId !== undefined
            ? updateAdmissionDto.wardId
            : existing.wardId;
        const nextBedId =
          updateAdmissionDto.bedId !== undefined
            ? updateAdmissionDto.bedId
            : existing.bedId;

        const updated = await tx.admission.update({
          where: { id },
          data: {
            ward: updateAdmissionDto.ward,
            wardId: updateAdmissionDto.wardId,
            bedId: updateAdmissionDto.bedId,
            room: updateAdmissionDto.room,
            reason: updateAdmissionDto.reason,
            updatedById: staffId,
            ...(updateAdmissionDto.attendingDoctorId !== undefined && {
              attendingDoctorId: updateAdmissionDto.attendingDoctorId || null,
            }),
          },
          include: ADMISSION_UPDATE_INCLUDE,
        });

        await this.recordWardHistory(tx, {
          admissionId: id,
          fromWardId: existing.wardId,
          toWardId: nextWardId,
          fromBedId: existing.bedId,
          toBedId: nextBedId,
          changedById: staffId,
          reason: 'Ward/bed change',
        });

        if (nextWardId && nextWardId !== existing.wardId) {
          await tx.patient.update({
            where: { id: existing.patientId },
            data: { wardId: nextWardId, updatedById: staffId },
          });
        }

        return updated;
      });
    }

    const outcome = updateAdmissionDto.outcome;
    if (!outcome) {
      throw new BadRequestException('outcome is required when discharging.');
    }
    const isDeath = outcome === 'Death';

    const result = await this.prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findUnique({
        where: { id },
        include: { encounter: true, bed: { select: { bedNumber: true } } },
      });
      if (!admission) throw new NotFoundException('Admission not found');
      if (admission.status !== AdmissionStatus.ACTIVE) {
        throw new BadRequestException(
          'Only active admissions can be clinically discharged.',
        );
      }

      const admissionInvoices = await this.getAdmissionInvoices(tx, admission);
      const invoiceIds = admissionInvoices.map((invoice) => invoice.id);

      const dischargedAt = new Date(updateAdmissionDto.dischargeDate!);
      for (const invoice of admissionInvoices) {
        await this.recalculateInvoiceTotalsForDischarge(
          invoice.id,
          dischargedAt,
          tx,
          staffId,
        );
      }

      await this.closeUsageSegmentsForDischarge(tx, invoiceIds, dischargedAt);

      const dischargeSummary =
        updateAdmissionDto.dischargeSummary?.trim() || null;
      const roomSnapshot =
        updateAdmissionDto.room ??
        admission.room ??
        admission.bed?.bedNumber ??
        null;

      const allPaid = await this.areAllAdmissionInvoicesPaid(tx, invoiceIds);
      const clinicalData = {
        dischargeDate: dischargedAt,
        dischargeDateTime: dischargedAt,
        outcome,
        dischargeSummary,
        bedId: null,
        clinicallyDischargedAt: dischargedAt,
        clinicallyDischargedById: staffId,
        ward: updateAdmissionDto.ward,
        room: roomSnapshot,
        reason: updateAdmissionDto.reason,
        updatedById: staffId,
        ...(updateAdmissionDto.attendingDoctorId !== undefined && {
          attendingDoctorId: updateAdmissionDto.attendingDoctorId || null,
        }),
        ...(allPaid && !isDeath
          ? {
              billingClearedAt: dischargedAt,
              billingClearedById: staffId,
            }
          : {}),
      };

      if (isDeath) {
        await tx.admission.update({
          where: { id },
          data: clinicalData,
        });
        return this.finalizeAdmission(tx, {
          admissionId: id,
          patientId: admission.patientId,
          outcome,
          staffId,
          billingClearedById: staffId,
          nursesClearedById: staffId,
        });
      }

      // Always require nurses clearance; billing may already be auto-cleared if paid.
      return tx.admission.update({
        where: { id },
        data: {
          ...clinicalData,
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
        },
        include: ADMISSION_UPDATE_INCLUDE,
      });
    });
    return result;
  }

  async remove(id: string) {
    return this.prisma.admission.delete({
      where: { id },
    });
  }
}
