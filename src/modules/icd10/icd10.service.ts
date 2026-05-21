import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListIcd10Dto } from './dto/list-icd10.dto';
import { SearchIcd10Dto } from './dto/search-icd10.dto';

export type Icd10CodeDto = {
  id: string;
  code: string;
  description: string;
  specialty: string;
  icdGroup: string;
  range: string;
};

@Injectable()
export class Icd10Service {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    code: string;
    description: string;
    specialty: string;
    icdGroup: string;
    range: string;
  }): Icd10CodeDto {
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      specialty: row.specialty,
      icdGroup: row.icdGroup,
      range: row.range,
    };
  }

  private buildTextFilter(q: string): Prisma.Icd10CodeWhereInput {
    const term = q.trim();
    return {
      OR: [
        { code: { startsWith: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ],
    };
  }

  private buildListWhere(query: ListIcd10Dto): Prisma.Icd10CodeWhereInput {
    const where: Prisma.Icd10CodeWhereInput = {};

    if (query.specialty?.trim()) {
      where.specialty = { equals: query.specialty.trim(), mode: 'insensitive' };
    }
    if (query.icdGroup?.trim()) {
      where.icdGroup = { equals: query.icdGroup.trim(), mode: 'insensitive' };
    }
    if (query.range?.trim()) {
      where.range = { equals: query.range.trim(), mode: 'insensitive' };
    }
    if (query.q?.trim()) {
      Object.assign(where, this.buildTextFilter(query.q));
    }

    return where;
  }

  async search(query: SearchIcd10Dto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where: Prisma.Icd10CodeWhereInput = {};

    if (query.specialty?.trim()) {
      where.specialty = { equals: query.specialty.trim(), mode: 'insensitive' };
    }
    if (query.icdGroup?.trim()) {
      where.icdGroup = { equals: query.icdGroup.trim(), mode: 'insensitive' };
    }

    const q = query.q?.trim();
    if (q) {
      Object.assign(where, this.buildTextFilter(q));
    }

    const [items, total] = await Promise.all([
      this.prisma.icd10Code.findMany({
        where,
        skip,
        take,
        orderBy: [{ code: 'asc' }],
      }),
      this.prisma.icd10Code.count({ where }),
    ]);

    return {
      items: items.map((row) => this.toDto(row)),
      total,
      skip,
      take,
    };
  }

  async findAll(query: ListIcd10Dto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where = this.buildListWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.icd10Code.findMany({
        where,
        skip,
        take,
        orderBy: [{ specialty: 'asc' }, { icdGroup: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.icd10Code.count({ where }),
    ]);

    return {
      items: items.map((row) => this.toDto(row)),
      total,
      skip,
      take,
    };
  }

  async findById(id: string) {
    const row = await this.prisma.icd10Code.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`ICD-10 code with id "${id}" not found`);
    }
    return this.toDto(row);
  }

  async findByCode(code: string) {
    const normalized = decodeURIComponent(code).trim();
    const row = await this.prisma.icd10Code.findUnique({
      where: { code: normalized },
    });
    if (!row) {
      throw new NotFoundException(`ICD-10 code "${normalized}" not found`);
    }
    return this.toDto(row);
  }

  async listSpecialties() {
    const rows = await this.prisma.icd10Code.findMany({
      distinct: ['specialty'],
      select: { specialty: true },
      orderBy: { specialty: 'asc' },
    });
    return {
      specialties: rows.map((r) => r.specialty),
      total: rows.length,
    };
  }

  async listGroups(specialty: string) {
    const rows = await this.prisma.icd10Code.findMany({
      where: {
        specialty: { equals: specialty.trim(), mode: 'insensitive' },
      },
      distinct: ['icdGroup'],
      select: { icdGroup: true, range: true },
      orderBy: { icdGroup: 'asc' },
    });

    return {
      specialty: specialty.trim(),
      groups: rows.map((r) => ({
        icdGroup: r.icdGroup,
        range: r.range,
      })),
      total: rows.length,
    };
  }
}
