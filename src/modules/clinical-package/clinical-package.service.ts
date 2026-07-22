import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PregnancyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateClinicalServicePackageDto,
  ListClinicalServicePackagesQueryDto,
  UpdateClinicalServicePackageDto,
  UpsertClinicalServicePackageItemDto,
} from './dto/clinical-service-package.dto';

const packageItemInclude = {
  service: {
    select: {
      id: true,
      name: true,
      searviceCode: true,
      cost: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
  },
  drug: {
    select: {
      id: true,
      genericName: true,
      brandName: true,
      strength: true,
    },
  },
} satisfies Prisma.ClinicalServicePackageItemInclude;

const packageInclude = {
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: packageItemInclude,
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ClinicalServicePackageInclude;

export type AntenatalPackageItemResolution = {
  packageId: string;
  packageItemId: string;
  serviceId?: string;
  drugId?: string;
};

@Injectable()
export class ClinicalPackageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClinicalServicePackageDto, staffId: string) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefaultAntenatal) {
        await tx.clinicalServicePackage.updateMany({
          where: { isDefaultAntenatal: true },
          data: { isDefaultAntenatal: false },
        });
      }
      return tx.clinicalServicePackage.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          isActive: dto.isActive ?? true,
          isDefaultAntenatal: dto.isDefaultAntenatal ?? false,
          createdById: staffId,
          updatedById: staffId,
        },
        include: packageInclude,
      });
    });
  }

  async findAll(query: ListClinicalServicePackagesQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 50;
    const where: Prisma.ClinicalServicePackageWhereInput = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    const [data, total] = await Promise.all([
      this.prisma.clinicalServicePackage.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: packageInclude,
      }),
      this.prisma.clinicalServicePackage.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const pkg = await this.prisma.clinicalServicePackage.findUnique({
      where: { id },
      include: packageInclude,
    });
    if (!pkg) {
      throw new NotFoundException(`Clinical package "${id}" not found.`);
    }
    return pkg;
  }

  async getDefaultAntenatalPackage() {
    const pkg = await this.prisma.clinicalServicePackage.findFirst({
      where: { isActive: true, isDefaultAntenatal: true },
      include: packageInclude,
    });
    if (!pkg) {
      throw new NotFoundException('No active default antenatal package is configured.');
    }
    return pkg;
  }

  async update(id: string, dto: UpdateClinicalServicePackageDto, staffId: string) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefaultAntenatal) {
        await tx.clinicalServicePackage.updateMany({
          where: { id: { not: id }, isDefaultAntenatal: true },
          data: { isDefaultAntenatal: false },
        });
      }
      return tx.clinicalServicePackage.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description ?? null,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.isDefaultAntenatal !== undefined && {
            isDefaultAntenatal: dto.isDefaultAntenatal,
          }),
          updatedById: staffId,
        },
        include: packageInclude,
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.clinicalServicePackage.delete({ where: { id } });
  }

  async addItem(packageId: string, dto: UpsertClinicalServicePackageItemDto) {
    await this.findOne(packageId);
    if (!dto.serviceId && !dto.drugId) {
      throw new BadRequestException(
        'Package item must include a serviceId and/or drugId.',
      );
    }
    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
      });
      if (!service) {
        throw new NotFoundException(`Service "${dto.serviceId}" not found.`);
      }
    }
    if (dto.drugId) {
      const drug = await this.prisma.drug.findUnique({
        where: { id: dto.drugId },
      });
      if (!drug) {
        throw new NotFoundException(`Drug "${dto.drugId}" not found.`);
      }
    }
    return this.prisma.clinicalServicePackageItem.create({
      data: {
        packageId,
        serviceId: dto.serviceId ?? null,
        drugId: dto.drugId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        notes: dto.notes ?? null,
      },
      include: packageItemInclude,
    });
  }

  async removeItem(packageId: string, itemId: string) {
    const item = await this.prisma.clinicalServicePackageItem.findFirst({
      where: { id: itemId, packageId },
    });
    if (!item) {
      throw new NotFoundException(`Package item "${itemId}" not found.`);
    }
    await this.prisma.clinicalServicePackageItem.delete({
      where: { id: itemId },
    });
  }

  async updateItem(
    packageId: string,
    itemId: string,
    dto: UpsertClinicalServicePackageItemDto,
  ) {
    const item = await this.prisma.clinicalServicePackageItem.findFirst({
      where: { id: itemId, packageId },
    });
    if (!item) {
      throw new NotFoundException(`Package item "${itemId}" not found.`);
    }
    const serviceId =
      dto.serviceId !== undefined ? dto.serviceId : item.serviceId;
    const drugId = dto.drugId !== undefined ? dto.drugId : item.drugId;
    if (!serviceId && !drugId) {
      throw new BadRequestException(
        'Package item must include a serviceId and/or drugId.',
      );
    }
    return this.prisma.clinicalServicePackageItem.update({
      where: { id: itemId },
      data: {
        ...(dto.serviceId !== undefined && { serviceId: dto.serviceId }),
        ...(dto.drugId !== undefined && { drugId: dto.drugId }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
      },
      include: packageItemInclude,
    });
  }

  async patientHasOngoingAntenatalCoverage(patientId: string): Promise<boolean> {
    const [pregnancy, pkg] = await Promise.all([
      this.prisma.pregnancy.findFirst({
        where: { patientId, status: PregnancyStatus.ONGOING },
        select: { id: true },
      }),
      this.prisma.clinicalServicePackage.findFirst({
        where: { isActive: true, isDefaultAntenatal: true },
        select: { id: true },
      }),
    ]);
    return !!(pregnancy && pkg);
  }

  async resolveAntenatalPackageItemForService(
    patientId: string,
    serviceId: string,
  ): Promise<AntenatalPackageItemResolution | null> {
    const covered = await this.patientHasOngoingAntenatalCoverage(patientId);
    if (!covered) {
      return null;
    }
    const pkg = await this.prisma.clinicalServicePackage.findFirst({
      where: { isActive: true, isDefaultAntenatal: true },
      select: { id: true },
    });
    if (!pkg) {
      return null;
    }
    const item = await this.prisma.clinicalServicePackageItem.findFirst({
      where: { packageId: pkg.id, serviceId },
    });
    if (!item) {
      return null;
    }
    return {
      packageId: pkg.id,
      packageItemId: item.id,
      serviceId,
    };
  }

  async resolveAntenatalPackageItemForDrug(
    patientId: string,
    drugId: string,
  ): Promise<AntenatalPackageItemResolution | null> {
    const covered = await this.patientHasOngoingAntenatalCoverage(patientId);
    if (!covered) {
      return null;
    }
    const pkg = await this.prisma.clinicalServicePackage.findFirst({
      where: { isActive: true, isDefaultAntenatal: true },
      select: { id: true },
    });
    if (!pkg) {
      return null;
    }
    const item = await this.prisma.clinicalServicePackageItem.findFirst({
      where: { packageId: pkg.id, drugId },
    });
    if (!item) {
      return null;
    }
    return {
      packageId: pkg.id,
      packageItemId: item.id,
      drugId,
    };
  }
}
