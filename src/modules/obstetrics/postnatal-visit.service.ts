import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PostnatalVisitType } from '@prisma/client';
import {
  CreatePostnatalVisitDto,
  UpdatePostnatalVisitDto,
} from './dto/create-postnatal-visit.dto';
import { ListPostnatalVisitsQueryDto } from './dto/list-postnatal-visits-query.dto';

@Injectable()
export class PostnatalVisitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePostnatalVisitDto) {
    const [labourDelivery, staff] = await Promise.all([
      this.prisma.labourDelivery.findUnique({
        where: { id: dto.labourDeliveryId },
      }),
      this.prisma.staff.findUnique({ where: { id: dto.staffId } }),
    ]);
    if (!labourDelivery) {
      throw new NotFoundException(
        `Labour/delivery "${dto.labourDeliveryId}" not found.`,
      );
    }
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);
    }
    if (dto.type === 'MOTHER' && !dto.patientId) {
      throw new BadRequestException(
        'patientId is required for MOTHER postnatal visits.',
      );
    }
    if (dto.type === 'BABY' && !dto.babyId) {
      throw new BadRequestException(
        'babyId is required for BABY postnatal visits.',
      );
    }
    if (dto.patientId) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: dto.patientId },
      });
      if (!patient)
        throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }
    if (dto.babyId) {
      const baby = await this.prisma.baby.findUnique({
        where: { id: dto.babyId },
        include: { labourDelivery: true },
      });
      if (!baby) throw new NotFoundException(`Baby "${dto.babyId}" not found.`);
      if (baby.labourDeliveryId !== dto.labourDeliveryId) {
        throw new BadRequestException(
          'Baby does not belong to this labour/delivery.',
        );
      }
    }

    return this.prisma.postnatalVisit.create({
      data: {
        labourDeliveryId: dto.labourDeliveryId,
        type: dto.type,
        visitDate: new Date(dto.visitDate),
        patientId: dto.patientId ?? null,
        babyId: dto.babyId ?? null,
        uterusInvolution: dto.uterusInvolution ?? null,
        lochia: dto.lochia ?? null,
        perineum: dto.perineum ?? null,
        bloodPressure: dto.bloodPressure ?? null,
        temperature: dto.temperature ?? null,
        breastfeeding: dto.breastfeeding ?? null,
        weight: dto.weight ?? null,
        feeding: dto.feeding ?? null,
        jaundice: dto.jaundice ?? null,
        immunisationGiven: dto.immunisationGiven ?? null,
        notes: dto.notes ?? null,
        staffId: dto.staffId,
      },
      include: {
        labourDelivery: { select: { id: true } },
        patient: true,
        baby: true,
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(query: ListPostnatalVisitsQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 50;
    const where: {
      labourDeliveryId?: string;
      type?: PostnatalVisitType;
      visitDate?: { gte?: Date; lte?: Date };
    } = {};
    if (query.labourDeliveryId) where.labourDeliveryId = query.labourDeliveryId;
    if (query.type) where.type = query.type;
    if (query.fromDate)
      where.visitDate = { ...where.visitDate, gte: new Date(query.fromDate) };
    if (query.toDate) {
      const to = new Date(query.toDate);
      to.setDate(to.getDate() + 1);
      where.visitDate = { ...where.visitDate, lte: to };
    }

    const [visits, total] = await Promise.all([
      this.prisma.postnatalVisit.findMany({
        where,
        skip,
        take,
        orderBy: { visitDate: 'desc' },
        include: {
          labourDelivery: { select: { id: true } },
          patient: { select: { id: true, firstName: true, surname: true } },
          baby: true,
          staff: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.postnatalVisit.count({ where }),
    ]);

    return { visits, total, skip, take };
  }

  async findOne(id: string) {
    const visit = await this.prisma.postnatalVisit.findUnique({
      where: { id },
      include: {
        labourDelivery: {
          include: { pregnancy: { include: { patient: true } } },
        },
        patient: true,
        baby: true,
        staff: true,
      },
    });
    if (!visit) {
      throw new NotFoundException(`Postnatal visit "${id}" not found.`);
    }
    return visit;
  }

  async update(id: string, dto: UpdatePostnatalVisitDto) {
    await this.findOne(id);
    return this.prisma.postnatalVisit.update({
      where: { id },
      data: {
        ...(dto.visitDate !== undefined && {
          visitDate: new Date(dto.visitDate),
        }),
        ...(dto.uterusInvolution !== undefined && {
          uterusInvolution: dto.uterusInvolution,
        }),
        ...(dto.lochia !== undefined && { lochia: dto.lochia }),
        ...(dto.perineum !== undefined && { perineum: dto.perineum }),
        ...(dto.bloodPressure !== undefined && {
          bloodPressure: dto.bloodPressure,
        }),
        ...(dto.temperature !== undefined && { temperature: dto.temperature }),
        ...(dto.breastfeeding !== undefined && {
          breastfeeding: dto.breastfeeding,
        }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.feeding !== undefined && { feeding: dto.feeding }),
        ...(dto.jaundice !== undefined && { jaundice: dto.jaundice }),
        ...(dto.immunisationGiven !== undefined && {
          immunisationGiven: dto.immunisationGiven,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        labourDelivery: true,
        patient: true,
        baby: true,
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
