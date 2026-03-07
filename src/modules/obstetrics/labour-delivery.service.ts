import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLabourDeliveryDto, UpdateLabourDeliveryDto } from './dto/create-labour-delivery.dto';

@Injectable()
export class LabourDeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabourDeliveryDto) {
    const pregnancy = await this.prisma.pregnancy.findUnique({
      where: { id: dto.pregnancyId },
    });
    if (!pregnancy) {
      throw new NotFoundException(`Pregnancy "${dto.pregnancyId}" not found.`);
    }
    if (pregnancy.patientId === undefined) {
      throw new BadRequestException('Pregnancy has no patient.');
    }
    const deliveredBy = await this.prisma.staff.findUnique({
      where: { id: dto.deliveredById },
    });
    if (!deliveredBy) {
      throw new NotFoundException(`Staff "${dto.deliveredById}" not found.`);
    }
    if (dto.admissionId) {
      const admission = await this.prisma.admission.findUnique({
        where: { id: dto.admissionId },
      });
      if (!admission) {
        throw new NotFoundException(`Admission "${dto.admissionId}" not found.`);
      }
      if (admission.patientId !== pregnancy.patientId) {
        throw new BadRequestException('Admission does not belong to the same patient as the pregnancy.');
      }
    }

    return this.prisma.labourDelivery.create({
      data: {
        pregnancyId: dto.pregnancyId,
        admissionId: dto.admissionId ?? null,
        deliveryDateTime: new Date(dto.deliveryDateTime),
        mode: dto.mode,
        outcome: dto.outcome,
        bloodLossMl: dto.bloodLossMl ?? null,
        placentaComplete: dto.placentaComplete ?? null,
        episiotomy: dto.episiotomy ?? null,
        perinealTearGrade: dto.perinealTearGrade ?? null,
        notes: dto.notes ?? null,
        deliveredById: dto.deliveredById,
      },
      include: {
        pregnancy: { include: { patient: true } },
        admission: true,
        deliveredBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findOne(id: string) {
    const delivery = await this.prisma.labourDelivery.findUnique({
      where: { id },
      include: {
        pregnancy: { include: { patient: true } },
        admission: true,
        deliveredBy: true,
        partogramEntries: { orderBy: { recordedAt: 'asc' } },
        babies: true,
      },
    });
    if (!delivery) {
      throw new NotFoundException(`Labour/delivery "${id}" not found.`);
    }
    return delivery;
  }

  async findByAdmission(admissionId: string) {
    const delivery = await this.prisma.labourDelivery.findFirst({
      where: { admissionId },
      include: {
        pregnancy: { include: { patient: true } },
        babies: true,
        partogramEntries: { orderBy: { recordedAt: 'asc' } },
      },
    });
    if (!delivery) {
      throw new NotFoundException(`No labour/delivery found for admission "${admissionId}".`);
    }
    return delivery;
  }

  async update(id: string, dto: UpdateLabourDeliveryDto) {
    await this.findOne(id);
    return this.prisma.labourDelivery.update({
      where: { id },
      data: {
        ...(dto.deliveryDateTime !== undefined && { deliveryDateTime: new Date(dto.deliveryDateTime) }),
        ...(dto.mode !== undefined && { mode: dto.mode }),
        ...(dto.outcome !== undefined && { outcome: dto.outcome }),
        ...(dto.bloodLossMl !== undefined && { bloodLossMl: dto.bloodLossMl }),
        ...(dto.placentaComplete !== undefined && { placentaComplete: dto.placentaComplete }),
        ...(dto.episiotomy !== undefined && { episiotomy: dto.episiotomy }),
        ...(dto.perinealTearGrade !== undefined && { perinealTearGrade: dto.perinealTearGrade }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        pregnancy: { select: { id: true, patientId: true } },
        deliveredBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
