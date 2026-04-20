import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAdmissionDto,
  UpdateAdmissionDto,
} from './dto/create-admission.dto';
import {
  EncounterStatus,
  InvoiceStatus,
  PatientStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class AdmissionService {
  constructor(private prisma: PrismaService) { }

  private readonly dayMs = 24 * 60 * 60 * 1000;

  private computeRecurringAmount(
    segments: Array<{ startAt: Date; endAt: Date | null }>,
    unitPrice: Prisma.Decimal,
    now: Date,
  ) {
    let totalDays = 0;
    for (const segment of segments) {
      const endAt = segment.endAt ?? now;
      const ms = endAt.getTime() - segment.startAt.getTime();
      if (ms <= 0) continue;
      totalDays += Math.ceil(ms / this.dayMs);
    }
    return unitPrice.mul(totalDays);
  }

  private async recalculateInvoiceTotalsForDischarge(
    invoiceId: string,
    now: Date = new Date(),
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        invoiceItems: {
          include: { usageSegments: true },
        },
      },
    });
    if (!invoice) return null;

    const totalAmount = invoice.invoiceItems.reduce((sum, item) => {
      if (item.isRecurringDaily) {
        return sum.add(
          this.computeRecurringAmount(item.usageSegments, item.unitPrice, now),
        );
      }
      return sum.add(item.unitPrice.mul(item.quantity));
    }, new Prisma.Decimal(0));

    let status: InvoiceStatus = InvoiceStatus.PENDING;
    if (totalAmount.gt(0) && invoice.amountPaid.gte(totalAmount)) {
      status = InvoiceStatus.PAID;
    } else if (invoice.amountPaid.gt(0)) {
      status = InvoiceStatus.PARTIALLY_PAID;
    }

    return tx.invoice.update({
      where: { id: invoice.id },
      data: { totalAmount, status },
    });
  }

  async create(createAdmissionDto: CreateAdmissionDto, @Req() req: any) {
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
      data: { admissionId: admission.id, status: EncounterStatus.COMPLETED },
    });

    await this.prisma.patient.update({
      where: { id: createAdmissionDto.patientId },
      data: {
        status: PatientStatus.ADMITED,
        wardId: createAdmissionDto.wardId ?? null,
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
        },
        orderBy: { admissionDate: 'desc' },
      }),
      this.prisma.admission.count({ where }),
    ]);

    return { admissions, total, skip, take };
  }

  async findOne(id: string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            surname: true,
            patientId: true,
            dob: true
          },
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
          }
        },
        patientVitals: true,
        medicationOrders: {
          include: {
            prescribedBy: {
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
      },
      orderBy: { admissionDate: 'asc' },
    });
  }

  async update(id: string, updateAdmissionDto: UpdateAdmissionDto) {
    if (!updateAdmissionDto.dischargeDate) {
      return this.prisma.admission.update({
        where: { id },
        data: {
          ward: updateAdmissionDto.ward,
          room: updateAdmissionDto.room,
          reason: updateAdmissionDto.reason,
          ...(updateAdmissionDto.attendingDoctorId !== undefined && {
            attendingDoctorId: updateAdmissionDto.attendingDoctorId || null,
          }),
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findUnique({
        where: { id },
        include: { encounter: true },
      });
      if (!admission) throw new NotFoundException('Admission not found');

      const invoiceConditions: Prisma.InvoiceWhereInput[] = [
        { encounter: { admissionId: id } },
      ];
      if (admission.encounter?.id) {
        invoiceConditions.push({ encounterId: admission.encounter.id });
      }

      const admissionInvoices = await tx.invoice.findMany({
        where: {
          patientId: admission.patientId,
          OR: invoiceConditions,
        },
      });

      const now = new Date();
      for (const invoice of admissionInvoices) {
        await this.recalculateInvoiceTotalsForDischarge(invoice.id, now, tx);
      }

      const unpaidCount = await tx.invoice.count({
        where: {
          id: { in: admissionInvoices.map((invoice) => invoice.id) },
          status: { not: InvoiceStatus.PAID },
        },
      });

      if (unpaidCount > 0) {
        throw new BadRequestException(
          'Cannot discharge patient while linked invoices are unpaid.',
        );
      }

      await tx.invoiceItemUsageSegment.updateMany({
        where: {
          endAt: null,
          invoiceItem: {
            invoice: {
              id: { in: admissionInvoices.map((invoice) => invoice.id) },
            },
          },
        },
        data: { endAt: now },
      });

      await tx.patient.update({
        where: { id: admission.patientId },
        data: {
          wardId: null,
          status: PatientStatus.OUTPATIENT,
        },
      });

      return tx.admission.update({
        where: { id },
        data: {
          dischargeDate: new Date(updateAdmissionDto.dischargeDate!),
          ward: updateAdmissionDto.ward,
          room: updateAdmissionDto.room,
          reason: updateAdmissionDto.reason,
          ...(updateAdmissionDto.attendingDoctorId !== undefined && {
            attendingDoctorId: updateAdmissionDto.attendingDoctorId || null,
          }),
        },
      });
    });
  }

  async remove(id: string) {
    return this.prisma.admission.delete({
      where: { id },
    });
  }
}
