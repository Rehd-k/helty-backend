import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBabyDto,
  UpdateBabyDto,
  RegisterBabyAsPatientDto,
} from './dto/create-baby.dto';
import { ListBabiesQueryDto } from './dto/list-babies-query.dto';

@Injectable()
export class BabyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBabyDto, createdById: string) {
    const [labourDelivery, mother, createdBy] = await Promise.all([
      this.prisma.labourDelivery.findUnique({
        where: { id: dto.labourDeliveryId },
      }),
      this.prisma.patient.findUnique({ where: { id: dto.motherId } }),
      this.prisma.staff.findUnique({ where: { id: createdById } }),
    ]);
    if (!labourDelivery) {
      throw new NotFoundException(
        `Labour/delivery "${dto.labourDeliveryId}" not found.`,
      );
    }
    if (!mother) {
      throw new NotFoundException(
        `Mother/patient "${dto.motherId}" not found.`,
      );
    }
    if (!createdBy) {
      throw new NotFoundException(`Staff "${dto.createdById}" not found.`);
    }
    const pregnancy = await this.prisma.pregnancy.findUnique({
      where: { id: labourDelivery.pregnancyId },
    });
    if (!pregnancy || pregnancy.patientId !== dto.motherId) {
      throw new BadRequestException(
        'Mother does not match the pregnancy for this delivery.',
      );
    }

    return this.prisma.baby.create({
      data: {
        labourDeliveryId: dto.labourDeliveryId,
        motherId: dto.motherId,
        sex: dto.sex,
        birthWeightG: dto.birthWeightG ?? null,
        birthLengthCm: dto.birthLengthCm ?? null,
        apgar1: dto.apgar1 ?? null,
        apgar5: dto.apgar5 ?? null,
        resuscitation: dto.resuscitation ?? null,
        birthOrder: dto.birthOrder ?? 1,
        createdById,
        updatedById: createdById,
      },
      include: {
        labourDelivery: { select: { id: true, deliveryDateTime: true } },
        mother: { select: { id: true, firstName: true, surname: true } },
      },
    });
  }

  async findAll(query: ListBabiesQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where: { motherId?: string; labourDeliveryId?: string } = {};
    if (query.motherId) where.motherId = query.motherId;
    if (query.labourDeliveryId) where.labourDeliveryId = query.labourDeliveryId;

    const [babies, total] = await Promise.all([
      this.prisma.baby.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          mother: { select: { id: true, firstName: true, surname: true } },
          labourDelivery: { select: { id: true, deliveryDateTime: true } },
        },
      }),
      this.prisma.baby.count({ where }),
    ]);

    return { babies, total, skip, take };
  }

  async findOne(id: string) {
    const baby = await this.prisma.baby.findUnique({
      where: { id },
      include: {
        mother: true,
        labourDelivery: { include: { pregnancy: true } },
        registeredPatient: true,
      },
    });
    if (!baby) {
      throw new NotFoundException(`Baby "${id}" not found.`);
    }
    return baby;
  }

  async update(id: string, dto: UpdateBabyDto) {
    await this.findOne(id);
    return this.prisma.baby.update({
      where: { id },
      data: {
        ...(dto.birthWeightG !== undefined && {
          birthWeightG: dto.birthWeightG,
        }),
        ...(dto.birthLengthCm !== undefined && {
          birthLengthCm: dto.birthLengthCm,
        }),
        ...(dto.apgar1 !== undefined && { apgar1: dto.apgar1 }),
        ...(dto.apgar5 !== undefined && { apgar5: dto.apgar5 }),
        ...(dto.resuscitation !== undefined && {
          resuscitation: dto.resuscitation,
        }),
      },
      include: {
        mother: { select: { id: true, firstName: true, surname: true } },
        labourDelivery: { select: { id: true, deliveryDateTime: true } },
      },
    });
  }

  async registerAsPatient(
    babyId: string,
    dto: RegisterBabyAsPatientDto,
    createdById: string,
  ) {
    const baby = await this.prisma.baby.findUnique({
      where: { id: babyId },
      include: { labourDelivery: true },
    });
    if (!baby) {
      throw new NotFoundException(`Baby "${babyId}" not found.`);
    }
    if (baby.registeredPatientId) {
      throw new BadRequestException('Baby is already registered as a patient.');
    }

    const dob = baby.labourDelivery.deliveryDateTime;
    const gender =
      dto.gender ??
      (baby.sex === 'M' ? 'Male' : baby.sex === 'F' ? 'Female' : 'Unknown');

    const patient = await this.prisma.patient.create({
      data: {
        firstName: dto.firstName,
        surname: dto.surname,
        otherName: dto.otherName ?? null,
        dob,
        gender,
        createdById,
        updatedById: createdById,
      },
    });

    await this.prisma.baby.update({
      where: { id: babyId },
      data: { registeredPatientId: patient.id, updatedById: createdById },
    });

    return this.prisma.baby.findUnique({
      where: { id: babyId },
      include: {
        mother: true,
        labourDelivery: true,
        registeredPatient: true,
      },
    });
  }
}
