import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabAstResultOptionDto } from './dto/create-lab-ast-result-option.dto';
import { UpdateLabAstResultOptionDto } from './dto/update-lab-ast-result-option.dto';

@Injectable()
export class LabAstResultOptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabAstResultOptionDto) {
    const label = dto.label.trim();
    const existing = await this.prisma.labAstResultOption.findUnique({
      where: { label },
    });
    if (existing) {
      throw new ConflictException(`AST result option "${label}" already exists.`);
    }
    return this.prisma.labAstResultOption.create({
      data: {
        label,
        code: dto.code?.trim() || null,
        isActive: dto.isActive ?? true,
        position: dto.position ?? 0,
      },
    });
  }

  async findAll(activeOnly = false, skip = 0, take = 50) {
    const where = activeOnly ? { isActive: true } : undefined;
    const [data, total] = await Promise.all([
      this.prisma.labAstResultOption.findMany({
        where,
        skip,
        take,
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      }),
      this.prisma.labAstResultOption.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const row = await this.prisma.labAstResultOption.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(`AST result option "${id}" not found.`);
    }
    return row;
  }

  async update(id: string, dto: UpdateLabAstResultOptionDto) {
    await this.findOne(id);
    if (dto.label?.trim()) {
      const duplicate = await this.prisma.labAstResultOption.findFirst({
        where: { label: dto.label.trim(), NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(
          `AST result option "${dto.label.trim()}" already exists.`,
        );
      }
    }
    return this.prisma.labAstResultOption.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const inUse = await this.prisma.labAstResult.count({
      where: { resultOptionId: id },
    });
    if (inUse > 0) {
      throw new ConflictException(
        'Cannot delete a result option that has AST results. Deactivate it instead.',
      );
    }
    await this.prisma.labAstResultOption.delete({ where: { id } });
  }
}
