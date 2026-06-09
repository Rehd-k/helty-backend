import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabAntibioticDto } from './dto/create-lab-antibiotic.dto';
import { UpdateLabAntibioticDto } from './dto/update-lab-antibiotic.dto';

@Injectable()
export class LabAntibioticService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabAntibioticDto) {
    const existing = await this.prisma.labAntibiotic.findUnique({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `Antibiotic "${dto.name.trim()}" already exists.`,
      );
    }
    return this.prisma.labAntibiotic.create({
      data: {
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        isActive: dto.isActive ?? true,
        position: dto.position ?? 0,
      },
    });
  }

  async findAll(activeOnly = false, skip = 0, take = 200) {
    const where = activeOnly ? { isActive: true } : undefined;
    const [data, total] = await Promise.all([
      this.prisma.labAntibiotic.findMany({
        where,
        skip,
        take,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.labAntibiotic.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const row = await this.prisma.labAntibiotic.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Lab antibiotic "${id}" not found.`);
    }
    return row;
  }

  async update(id: string, dto: UpdateLabAntibioticDto) {
    await this.findOne(id);
    if (dto.name?.trim()) {
      const duplicate = await this.prisma.labAntibiotic.findFirst({
        where: { name: dto.name.trim(), NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(
          `Antibiotic "${dto.name.trim()}" already exists.`,
        );
      }
    }
    return this.prisma.labAntibiotic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const inUse = await this.prisma.labAstResult.count({
      where: { antibioticId: id },
    });
    if (inUse > 0) {
      throw new ConflictException(
        'Cannot delete an antibiotic that has AST results. Deactivate it instead.',
      );
    }
    await this.prisma.labAntibiotic.delete({ where: { id } });
  }
}
