import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import {
  CreateMedicationOrderDto,
  UpdateMedicationOrderDto,
} from './dto/create-medication-order.dto';

@Injectable()
export class MedicationOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) { }

  async create(dto: CreateMedicationOrderDto) {
    await this.validateEncounter(dto.encounterId);
    if (dto.admissionId) {
      await this.validateAdmission(dto.admissionId, dto.encounterId, dto.patientId);
    }
    const drug = await this.validateDrug(dto.drugId);
    const patient = await this.validatePatient(dto.patientId);
    const doctor = await this.validateDoctor(dto.doctorId);
    const order = await this.prisma.medicationOrder.create({
      data: {
        encounterId: dto.encounterId,
        admissionId: dto.admissionId,
        drugId: dto.drugId,
        drugName: drug.genericName,
        dose: dto.dose ?? undefined,
        frequency: dto.frequency ?? undefined,
        duration: dto.duration ?? undefined,
        route: dto.route ?? undefined,
        specialInstructions: dto.specialInstructions ?? undefined,
        startDateTime: dto.startDateTime ? new Date(dto.startDateTime) : undefined,
        endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : undefined,
        notes: dto.notes ?? undefined,
        administrationStatus: dto.administrationStatus ?? undefined,
        patientId: patient.id,
        doctorId: doctor.id,
      },
      include: this.defaultInclude(),
    });
    const invoice = await this.invoiceService.ensureInvoiceForEncounter({
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      staffId: dto.doctorId,
    });
    await this.invoiceService.addDrugItem({
      invoiceId: invoice.id,
      drugId: dto.drugId,
      quantity: Number(dto.quantity) ?? 1,
      createdByStaffId: dto.doctorId,
    });
    return order;
  }

  async findAll(skip = 0, take = 20, encounterId?: string, status?: string) {
    const where: { encounterId?: string; status?: string } = {};
    if (encounterId) where.encounterId = encounterId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.medicationOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: this.defaultInclude(),
      }),
      this.prisma.medicationOrder.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const order = await this.prisma.medicationOrder.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!order) {
      throw new NotFoundException(
        `Medication order with id "${id}" not found.`,
      );
    }
    return order;
  }

  async findByEncounterId(encounterId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Encounter with id "${encounterId}" not found.`,
      );
    }

    return this.prisma.medicationOrder.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });
  }

  async update(id: string, dto: UpdateMedicationOrderDto) {
    const existing = await this.findOne(id);

    let drugName: string | undefined;
    if (dto.drugId !== undefined && dto.drugId !== existing.drugId) {
      const drug = await this.validateDrug(dto.drugId);
      drugName = drug.genericName;
    }

    return this.prisma.medicationOrder.update({
      where: { id },
      data: {
        ...(dto.drugId !== undefined &&
          drugName !== undefined && {
          drugId: dto.drugId,
          drugName,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dose !== undefined && { dose: dto.dose }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.route !== undefined && { route: dto.route }),
        ...(dto.specialInstructions !== undefined && {
          specialInstructions: dto.specialInstructions,
        }),
        ...(dto.administrationStatus !== undefined && {
          administrationStatus: dto.administrationStatus,
        }),
        ...(dto.endDateTime !== undefined && {
          endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: this.defaultInclude(),
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.medicationOrder.delete({ where: { id } });
  }

  private async validateEncounter(encounterId: string): Promise<void> {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Encounter with id "${encounterId}" not found.`,
      );
    }
  }

  private async validateDrug(drugId: string) {
    const drug = await this.prisma.drug.findUnique({
      where: { id: drugId },
    });
    if (!drug) {
      throw new NotFoundException(`Drug with id "${drugId}" not found.`);
    }
    return drug;
  }

  private async validateAdmission(
    admissionId: string,
    encounterId: string,
    patientId: string,
  ) {
    const admission = await this.prisma.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, patientId: true, encounter: { select: { id: true } } },
    });
    if (!admission) {
      throw new NotFoundException(`Admission with id "${admissionId}" not found.`);
    }
    if (admission.patientId !== patientId) {
      throw new BadRequestException(
        'Admission does not belong to the given patient.',
      );
    }
    if (admission.encounter?.id !== encounterId) {
      throw new BadRequestException(
        'Admission does not belong to the given encounter.',
      );
    }
  }

  private async validatePatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient with id "${patientId}" not found.`);
    }
    return patient;
  }

  private async validateDoctor(doctorId: string) {
    const doctor = await this.prisma.staff.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with id "${doctorId}" not found.`);
    }
    return doctor;
  }

  private defaultInclude() {
    return {
      encounter: {
        select: {
          id: true,
          encounterType: true,
          status: true,
          patientId: true,
        },
      },
      admission: {
        select: {
          id: true,
          status: true,
          admissionDate: true,
        },
      },
      doctor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      drug: {
        select: {
          id: true,
          genericName: true,
        },
      },
    };
  }
}
