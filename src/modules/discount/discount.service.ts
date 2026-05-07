import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountReason, InvoiceCoverageMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDiscountPolicyDto,
  QueryDiscountPolicyDto,
  UpdateDiscountPolicyDto,
} from './dto/discount-policy.dto';

@Injectable()
export class DiscountService {
  constructor(private readonly prisma: PrismaService) {}

  private asDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private async assertStaffExists(id: string): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      select: { id: true, accountType: true, staffRole: true },
    });
    if (!staff) throw new NotFoundException(`Staff "${id}" not found.`);
  }

  private validatePolicyValue(mode: InvoiceCoverageMode, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException('value must be a positive number');
    }
    if (mode === InvoiceCoverageMode.PERCENT && value > 100) {
      throw new BadRequestException('Percent discounts cannot exceed 100');
    }
  }

  async create(dto: CreateDiscountPolicyDto, req: { user: { sub: string } }) {
    const creatorId = req.user.sub;
    await this.assertStaffExists(creatorId);

    const ownerId = dto.ownerId ?? creatorId;
    await this.assertStaffExists(ownerId);

    this.validatePolicyValue(dto.mode, dto.value);

    const existing = await this.prisma.discountPolicy.findFirst({
      where: { name: { equals: dto.name.trim(), mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Discount policy "${dto.name}" already exists.`);
    }

    return this.prisma.discountPolicy.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        reason: dto.reason,
        mode: dto.mode,
        value: this.asDecimal(dto.value),
        active: dto.active ?? true,
        ownerId,
        createdById: creatorId,
        updatedById: creatorId,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(query: QueryDiscountPolicyDto) {
    const skip = Number(query.skip ?? 0);
    const take = Math.min(Number(query.take ?? 20), 100);
    const search = query.search?.trim();

    const where: Prisma.DiscountPolicyWhereInput = {
      ...(query.reason ? { reason: query.reason } : {}),
      ...(query.active !== undefined ? { active: Boolean(query.active) } : {}),
      ...(search
        ? { name: { contains: search, mode: 'insensitive' } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.discountPolicy.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.discountPolicy.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const policy = await this.prisma.discountPolicy.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!policy) throw new NotFoundException(`Discount policy "${id}" not found.`);
    return policy;
  }

  async update(
    id: string,
    dto: UpdateDiscountPolicyDto,
    req: { user: { sub: string; staffRole?: string; accountType?: string } },
  ) {
    await this.findOne(id);
    const updaterId = req.user.sub;
    await this.assertStaffExists(updaterId);

    if (dto.mode !== undefined && dto.value !== undefined) {
      this.validatePolicyValue(dto.mode, dto.value);
    }

    if (dto.name !== undefined) {
      const conflict = await this.prisma.discountPolicy.findFirst({
        where: {
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          NOT: { id },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException(
          `Another discount policy already uses the name "${dto.name}".`,
        );
      }
    }

    if (dto.ownerId !== undefined) {
      await this.assertStaffExists(dto.ownerId);
    }

    const mode = dto.mode;
    const value = dto.value;
    if (mode !== undefined && value !== undefined) {
      this.validatePolicyValue(mode, value);
    }

    return this.prisma.discountPolicy.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason as DiscountReason } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.value !== undefined ? { value: this.asDecimal(dto.value) } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
        updatedById: updaterId,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const usageCount = await this.prisma.invoiceCoverage.count({
      where: { policyId: id, status: { not: 'REVERSED' } },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        'Cannot delete this discount policy because it has been applied to one or more invoices. Deactivate it instead.',
      );
    }

    await this.prisma.discountPolicy.delete({ where: { id } });
    return { message: 'Discount policy deleted successfully.' };
  }
}

