import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateHmoDto,
  UpdateHmoDto,
  QueryHmoDto,
  QueryHmoPatientsDto,
  HmoServicePriceItemDto,
} from './dto/hmo.dto';

@Injectable()
export class HmoService {
  private readonly logger = new Logger(HmoService.name);

  constructor(private readonly prisma: PrismaService) {}

  private asDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private assertPriceSplit(
    fullCost: Prisma.Decimal,
    hmoPays: Prisma.Decimal,
    patientPays: Prisma.Decimal,
  ): void {
    if (fullCost.isNeg() || hmoPays.isNeg() || patientPays.isNeg()) {
      throw new BadRequestException(
        'fullCost, hmoPays, and patientPays must be greater than or equal to 0.',
      );
    }
    const sum = hmoPays.plus(patientPays);
    if (!fullCost.equals(sum)) {
      throw new BadRequestException(
        `For each service price row, hmoPays + patientPays must equal fullCost ` +
          `(got hmoPays=${hmoPays.toFixed(2)} + patientPays=${patientPays.toFixed(2)} ` +
          `=${sum.toFixed(2)}, fullCost=${fullCost.toFixed(2)}).`,
      );
    }
  }

  private validatePriceRows(rows: HmoServicePriceItemDto[]): void {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.serviceId)) {
        throw new BadRequestException(
          `Duplicate serviceId "${row.serviceId}" in servicePrices.`,
        );
      }
      seen.add(row.serviceId);
      this.assertPriceSplit(
        this.asDecimal(row.fullCost),
        this.asDecimal(row.hmoPays),
        this.asDecimal(row.patientPays),
      );
      if (row.coveragePercent !== undefined && row.coveragePercent !== null) {
        if (row.coveragePercent < 0 || row.coveragePercent > 100) {
          throw new BadRequestException(
            `coveragePercent must be between 0 and 100 (serviceId "${row.serviceId}").`,
          );
        }
      }
    }
  }

  private async assertServicesExist(serviceIds: string[]): Promise<void> {
    if (serviceIds.length === 0) return;
    const found = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true },
    });
    if (found.length !== serviceIds.length) {
      const foundIds = new Set(found.map((s) => s.id));
      const missing = serviceIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Unknown service id(s): ${missing.join(', ')}`,
      );
    }
  }

  async create(dto: CreateHmoDto, req: { user: { sub: string } }) {
    const existing = await this.prisma.hmo.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(
        `An HMO with name "${dto.name}" already exists.`,
      );
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: req.user.sub },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${req.user.sub}" not found.`);

    const prices = dto.servicePrices ?? [];
    this.validatePriceRows(prices);
    await this.assertServicesExist(prices.map((p) => p.serviceId));

    const hmo = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hmo.create({
        data: {
          name: dto.name.trim(),
          code: dto.code?.trim() || null,
          notes: dto.notes?.trim() || null,
          defaultCoveragePercent:
            dto.defaultCoveragePercent !== undefined
              ? this.asDecimal(dto.defaultCoveragePercent)
              : null,
          createdById: req.user.sub,
          updatedById: req.user.sub,
        },
      });

      if (prices.length > 0) {
        await tx.hmoServicePrice.createMany({
          data: prices.map((p) => ({
            hmoId: created.id,
            serviceId: p.serviceId,
            fullCost: this.asDecimal(p.fullCost),
            hmoPays: this.asDecimal(p.hmoPays),
            patientPays: this.asDecimal(p.patientPays),
            coveragePercent:
              p.coveragePercent !== undefined
                ? this.asDecimal(p.coveragePercent)
                : null,
          })),
        });
      }

      return created;
    });

    this.logger.log(`HMO "${hmo.name}" created — id: ${hmo.id}`);
    return this.findOne(hmo.id);
  }

  async findAll(query: QueryHmoDto) {
    const skip = Number(query.skip ?? 0);
    const take = Math.min(Number(query.take ?? 20), 100);
    const search = query.search?.trim();

    const where: Prisma.HmoWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.hmo.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { patients: true, servicePrices: true } },
        },
      }),
      this.prisma.hmo.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const hmo = await this.prisma.hmo.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        servicePrices: {
          orderBy: { service: { name: 'asc' } },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                searviceCode: true,
                cost: true,
                description: true,
              },
            },
          },
        },
        _count: { select: { patients: true } },
      },
    });
    if (!hmo) throw new NotFoundException(`HMO "${id}" not found.`);
    return hmo;
  }

  async findPatients(hmoId: string, query: QueryHmoPatientsDto) {
    await this.findOne(hmoId);

    const skip = Number(query.skip ?? 0);
    const take = Math.min(Number(query.take ?? 20), 100);
    const search = query.search?.trim();

    const where: Prisma.PatientWhereInput = {
      hmoId,
      ...(search
        ? {
            OR: [
              { surname: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { phoneNumber: { contains: search, mode: 'insensitive' } },
              { patientId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take,
        orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          patientId: true,
          surname: true,
          firstName: true,
          otherName: true,
          phoneNumber: true,
          email: true,
          hmo: true,
          hmoId: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { data, total, skip, take, hmoId };
  }

  async update(id: string, dto: UpdateHmoDto, req: { user: { sub: string } }) {
    await this.findOne(id);

    const staff = await this.prisma.staff.findUnique({
      where: { id: req.user.sub },
    });
    if (!staff)
      throw new NotFoundException(`Staff "${req.user.sub}" not found.`);

    if (dto.name !== undefined) {
      const conflict = await this.prisma.hmo.findFirst({
        where: {
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Another HMO already uses the name "${dto.name}".`,
        );
      }
    }

    if (dto.servicePrices !== undefined) {
      this.validatePriceRows(dto.servicePrices);
      await this.assertServicesExist(dto.servicePrices.map((p) => p.serviceId));

      await this.prisma.$transaction(async (tx) => {
        await tx.hmoServicePrice.deleteMany({ where: { hmoId: id } });
        if (dto.servicePrices!.length > 0) {
          await tx.hmoServicePrice.createMany({
            data: dto.servicePrices!.map((p) => ({
              hmoId: id,
              serviceId: p.serviceId,
              fullCost: this.asDecimal(p.fullCost),
              hmoPays: this.asDecimal(p.hmoPays),
              patientPays: this.asDecimal(p.patientPays),
              coveragePercent:
                p.coveragePercent !== undefined
                  ? this.asDecimal(p.coveragePercent)
                  : null,
            })),
          });
        }
      });
    }

    const updated = await this.prisma.hmo.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.code !== undefined && { code: dto.code?.trim() || null }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        ...(dto.defaultCoveragePercent !== undefined && {
          defaultCoveragePercent:
            dto.defaultCoveragePercent !== null
              ? this.asDecimal(dto.defaultCoveragePercent)
              : null,
        }),
        updatedById: req.user.sub,
      },
    });

    this.logger.log(`HMO "${updated.id}" updated.`);
    return this.findOne(updated.id);
  }

  async remove(id: string) {
    await this.findOne(id);

    const patientCount = await this.prisma.patient.count({
      where: { hmoId: id },
    });
    if (patientCount > 0) {
      throw new BadRequestException(
        `Cannot delete HMO "${id}" — ${patientCount} patient(s) are linked to it. ` +
          `Reassign or clear their hmoId first.`,
      );
    }

    await this.prisma.hmo.delete({ where: { id } });
    this.logger.log(`HMO "${id}" deleted.`);
    return { message: 'HMO deleted successfully.' };
  }
}
