import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDrugInteractionDto } from './dto/drug-interaction.dto';

@Injectable()
export class PharmacyDrugInteractionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDrugInteractionDto) {
    if (dto.drugAId === dto.drugBId) {
      throw new BadRequestException('Drug A and Drug B must be different.');
    }
    const [drugA, drugB] = await Promise.all([
      this.prisma.drug.findFirst({
        where: { id: dto.drugAId, deletedAt: null },
      }),
      this.prisma.drug.findFirst({
        where: { id: dto.drugBId, deletedAt: null },
      }),
    ]);
    if (!drugA) throw new NotFoundException(`Drug "${dto.drugAId}" not found.`);
    if (!drugB) throw new NotFoundException(`Drug "${dto.drugBId}" not found.`);

    const [aId, bId] =
      dto.drugAId < dto.drugBId
        ? [dto.drugAId, dto.drugBId]
        : [dto.drugBId, dto.drugAId];
    try {
      return await this.prisma.drugInteraction.create({
        data: {
          drugAId: aId,
          drugBId: bId,
          severity: dto.severity.trim(),
        },
        include: {
          drugA: { select: { id: true, genericName: true, brandName: true } },
          drugB: { select: { id: true, genericName: true, brandName: true } },
        },
      });
    } catch (e) {
      if (e.code === 'P2002') {
        throw new ConflictException('This drug interaction already exists.');
      }
      throw new BadRequestException('Invalid drug interaction data.');
    }
  }

  async findByDrugId(drugId: string) {
    const drug = await this.prisma.drug.findFirst({
      where: { id: drugId, deletedAt: null },
    });
    if (!drug) throw new NotFoundException(`Drug "${drugId}" not found.`);

    const interactions = await this.prisma.drugInteraction.findMany({
      where: { OR: [{ drugAId: drugId }, { drugBId: drugId }] },
      include: {
        drugA: { select: { id: true, genericName: true, brandName: true } },
        drugB: { select: { id: true, genericName: true, brandName: true } },
      },
      orderBy: { severity: 'asc' },
    });
    return { data: interactions };
  }

  async findAll(skip = 0, take = 50) {
    const [data, total] = await Promise.all([
      this.prisma.drugInteraction.findMany({
        skip: Math.max(0, skip),
        take: Math.min(Math.max(1, take), 100),
        include: {
          drugA: { select: { id: true, genericName: true, brandName: true } },
          drugB: { select: { id: true, genericName: true, brandName: true } },
        },
        orderBy: [
          { drugA: { genericName: 'asc' } },
          { drugB: { genericName: 'asc' } },
        ],
      }),
      this.prisma.drugInteraction.count(),
    ]);
    return { data, total, skip, take };
  }

  async remove(id: string) {
    const interaction = await this.prisma.drugInteraction.findUnique({
      where: { id },
    });
    if (!interaction) {
      throw new NotFoundException(`Drug interaction "${id}" not found.`);
    }
    return this.prisma.drugInteraction.delete({ where: { id } });
  }
}
