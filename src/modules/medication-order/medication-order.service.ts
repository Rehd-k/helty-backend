import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMedicationOrderDto,
  UpdateMedicationOrderDto,
} from './dto/create-medication-order.dto';

@Injectable()
export class MedicationOrderService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateMedicationOrderDto) {
    await this.validateEncounter(dto.encounterId);
    const drug = await this.validateDrug(dto.drugId);
    const patient = await this.validatePatient(dto.patientId);
    const doctor = await this.validateDoctor(dto.doctorId);
    return this.prisma.medicationOrder.create({
      data: {
        encounterId: dto.encounterId,
        drugId: dto.drugId,
        drugName: drug.genericName,
        dose: dto.dose ?? undefined,
        frequency: dto.frequency ?? undefined,
        duration: dto.duration ?? undefined,
        route: dto.route ?? undefined,
        specialInstructions: dto.specialInstructions ?? undefined,
        patientId: patient.id,
        doctorId: doctor.id,
      },
      include: this.defaultInclude(),
    });
  }

  async findAll(
    skip = 0,
    take = 20,
    encounterId?: string,
    status?: string,
  ) {
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
      throw new NotFoundException(`Medication order with id "${id}" not found.`);
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
    await this.findOne(id);

    return this.prisma.medicationOrder.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dose !== undefined && { dose: dto.dose }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.route !== undefined && { route: dto.route }),
        ...(dto.specialInstructions !== undefined && {
          specialInstructions: dto.specialInstructions,
        }),
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
      drug: {
        select: {
          id: true,
          genericName: true
        },
      },
    };
  }
}
