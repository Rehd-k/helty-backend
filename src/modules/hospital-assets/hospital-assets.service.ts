import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountType,
  HospitalAssetLogType,
  HospitalAssetStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';
import {
  headedAccountTypeForRole,
  isHospitalWideInventoryRole,
  isOperationalInventoryDepartment,
} from '../../common/constants/department-head.constants';
import {
  CreateHospitalAssetDto,
  CreateHospitalAssetLogDto,
  QueryHospitalAssetDto,
  TransferHospitalAssetDto,
  UpdateHospitalAssetDto,
  UpsertHospitalAssetAccessDto,
} from './dto/hospital-assets.dto';

const assetInclude = {
  createdBy: { select: staffBriefSelect },
  updatedBy: { select: staffBriefSelect },
} as const;

type Actor = {
  id: string;
  accountType: AccountType;
  staffRole: string;
};

type AssetAccess = {
  viewAccountTypes: AccountType[] | 'ALL';
  logAccountTypes: AccountType[] | 'ALL';
  manageAccountTypes: AccountType[] | 'ALL';
};

@Injectable()
export class HospitalAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadActor(actorId: string): Promise<Actor> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: actorId },
      select: { id: true, accountType: true, staffRole: true },
    });
    if (!staff) throw new NotFoundException('Staff not found.');
    return staff;
  }

  async resolveAccess(actor: Actor): Promise<AssetAccess> {
    if (isHospitalWideInventoryRole(actor)) {
      return {
        viewAccountTypes: 'ALL',
        logAccountTypes: 'ALL',
        manageAccountTypes: 'ALL',
      };
    }

    const headed = headedAccountTypeForRole(
      actor.staffRole,
      actor.accountType,
    );
    const grants = await this.prisma.hospitalAssetAccessGrant.findMany({
      where: { staffId: actor.id },
    });

    const ownDept = isOperationalInventoryDepartment(actor.accountType)
      ? actor.accountType
      : null;

    const view = new Set<AccountType>();
    const log = new Set<AccountType>();
    const manage = new Set<AccountType>();
    if (ownDept) view.add(ownDept);
    if (headed) {
      log.add(headed);
      manage.add(headed);
    }
    for (const g of grants) {
      // Grants never open another department's inventory.
      if (ownDept && g.accountType !== ownDept) continue;
      if (!ownDept) continue;
      if (g.canView || g.canLog) view.add(g.accountType);
      if (g.canLog) log.add(g.accountType);
    }

    return {
      viewAccountTypes: [...view],
      logAccountTypes: [...log],
      manageAccountTypes: [...manage],
    };
  }

  private canView(access: AssetAccess, accountType: AccountType): boolean {
    return (
      access.viewAccountTypes === 'ALL' ||
      access.viewAccountTypes.includes(accountType)
    );
  }

  private canLog(access: AssetAccess, accountType: AccountType): boolean {
    return (
      access.logAccountTypes === 'ALL' ||
      access.logAccountTypes.includes(accountType)
    );
  }

  private canManage(access: AssetAccess, accountType: AccountType): boolean {
    return (
      access.manageAccountTypes === 'ALL' ||
      access.manageAccountTypes.includes(accountType)
    );
  }

  private assertView(access: AssetAccess, accountType: AccountType) {
    if (!this.canView(access, accountType)) {
      throw new ForbiddenException(
        'You do not have access to this department inventory.',
      );
    }
  }

  private assertLog(access: AssetAccess, accountType: AccountType) {
    if (!this.canLog(access, accountType)) {
      throw new ForbiddenException(
        'You cannot log inventory for this department.',
      );
    }
  }

  private assertManage(access: AssetAccess, accountType: AccountType) {
    if (!this.canManage(access, accountType)) {
      throw new ForbiddenException(
        'Only the department head can manage this inventory.',
      );
    }
  }

  private defaultAccountType(actor: Actor, requested?: AccountType): AccountType {
    if (isHospitalWideInventoryRole(actor)) {
      if (!requested) {
        throw new BadRequestException('accountType is required.');
      }
      return requested;
    }
    const headed = headedAccountTypeForRole(
      actor.staffRole,
      actor.accountType,
    );
    if (headed) {
      if (requested && requested !== headed) {
        throw new ForbiddenException(
          'You may only manage your own department inventory.',
        );
      }
      return headed;
    }
    if (isOperationalInventoryDepartment(actor.accountType)) {
      if (requested && requested !== actor.accountType) {
        throw new ForbiddenException(
          'You may only access your own department inventory.',
        );
      }
      return actor.accountType;
    }
    throw new ForbiddenException('No inventory department assigned.');
  }

  async me(actorId: string) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);
    const view =
      access.viewAccountTypes === 'ALL'
        ? 'ALL'
        : access.viewAccountTypes;
    const log =
      access.logAccountTypes === 'ALL' ? 'ALL' : access.logAccountTypes;
    const manage =
      access.manageAccountTypes === 'ALL'
        ? 'ALL'
        : access.manageAccountTypes;
    const canView = view === 'ALL' || view.length > 0;
    const canLog = log === 'ALL' || log.length > 0;
    const canManage = manage === 'ALL' || manage.length > 0;
    return { canView, canLog, canManage, view, log, manage };
  }

  async list(actorId: string, query: QueryHospitalAssetDto) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);

    const where: Prisma.HospitalAssetWhereInput = {};
    if (access.viewAccountTypes === 'ALL') {
      if (query.accountType) where.accountType = query.accountType;
    } else {
      if (!access.viewAccountTypes.length) {
        return [];
      }
      if (query.accountType) {
        this.assertView(access, query.accountType);
        where.accountType = query.accountType;
      } else {
        where.accountType = { in: access.viewAccountTypes };
      }
    }
    if (query.kind) where.kind = query.kind;
    if (query.status) where.status = query.status;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { assetTag: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.hospitalAsset.findMany({
      where,
      orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
      include: assetInclude,
    });
  }

  async get(actorId: string, assetId: string) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);
    const asset = await this.prisma.hospitalAsset.findUnique({
      where: { id: assetId },
      include: {
        ...assetInclude,
        logs: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: staffBriefSelect } },
        },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    this.assertView(access, asset.accountType);
    return asset;
  }

  async create(actorId: string, dto: CreateHospitalAssetDto) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);
    const accountType = this.defaultAccountType(actor, dto.accountType);
    this.assertManage(access, accountType);

    try {
      return await this.prisma.hospitalAsset.create({
        data: {
          name: dto.name,
          assetTag: dto.assetTag.trim(),
          kind: dto.kind,
          status: dto.status ?? HospitalAssetStatus.IN_USE,
          accountType,
          serialNumber: dto.serialNumber,
          manufacturer: dto.manufacturer,
          model: dto.model,
          locationNote: dto.locationNote,
          acquiredAt: dto.acquiredAt ? new Date(dto.acquiredAt) : undefined,
          notes: dto.notes,
          createdById: actorId,
          logs: {
            create: {
              type: HospitalAssetLogType.CREATED,
              toStatus: dto.status ?? HospitalAssetStatus.IN_USE,
              toAccountType: accountType,
              note: 'Asset registered',
              createdBy: { connect: { id: actorId } },
            },
          },
        },
        include: assetInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('Asset tag is already in use.');
      }
      throw e;
    }
  }

  async update(actorId: string, assetId: string, dto: UpdateHospitalAssetDto) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);
    const asset = await this.prisma.hospitalAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset) throw new NotFoundException('Asset not found.');

    const statusChanging =
      dto.status !== undefined && dto.status !== asset.status;
    if (statusChanging) {
      this.assertLog(access, asset.accountType);
    } else {
      this.assertManage(access, asset.accountType);
    }

    const logs: Prisma.HospitalAssetLogCreateWithoutAssetInput[] = [];
    if (statusChanging) {
      logs.push({
        type: HospitalAssetLogType.STATUS_CHANGE,
        fromStatus: asset.status,
        toStatus: dto.status,
        note: dto.notes,
        createdBy: { connect: { id: actorId } },
      });
    }

    return this.prisma.hospitalAsset.update({
      where: { id: assetId },
      data: {
        name: dto.name,
        kind: dto.kind,
        status: dto.status,
        serialNumber: dto.serialNumber,
        manufacturer: dto.manufacturer,
        model: dto.model,
        locationNote: dto.locationNote,
        acquiredAt: dto.acquiredAt ? new Date(dto.acquiredAt) : undefined,
        notes: dto.notes,
        updatedById: actorId,
        ...(logs.length
          ? { logs: { create: logs } }
          : {}),
      },
      include: assetInclude,
    });
  }

  async addLog(actorId: string, assetId: string, dto: CreateHospitalAssetLogDto) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);
    const asset = await this.prisma.hospitalAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    this.assertLog(access, asset.accountType);

    if (dto.type === HospitalAssetLogType.CREATED) {
      throw new BadRequestException('CREATED logs are system-generated.');
    }

    const toStatus = dto.toStatus;
    const statusUpdate =
      toStatus && toStatus !== asset.status ? { status: toStatus } : {};

    const [, log] = await this.prisma.$transaction([
      this.prisma.hospitalAsset.update({
        where: { id: assetId },
        data: { ...statusUpdate, updatedById: actorId },
      }),
      this.prisma.hospitalAssetLog.create({
        data: {
          assetId,
          type: dto.type,
          fromStatus: toStatus ? asset.status : undefined,
          toStatus,
          note: dto.note,
          createdById: actorId,
        },
        include: { createdBy: { select: staffBriefSelect } },
      }),
    ]);
    return log;
  }

  async transfer(actorId: string, assetId: string, dto: TransferHospitalAssetDto) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);
    const asset = await this.prisma.hospitalAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    this.assertManage(access, asset.accountType);

    if (!dto.toAccountType && !dto.transferredToNote?.trim()) {
      throw new BadRequestException(
        'Provide toAccountType (internal) or transferredToNote (external).',
      );
    }

    const external = !!dto.transferredToNote?.trim() && !dto.toAccountType;
    const toAccountType = dto.toAccountType ?? asset.accountType;
    const toStatus = external
      ? HospitalAssetStatus.TRANSFERRED
      : HospitalAssetStatus.IN_USE;

    return this.prisma.hospitalAsset.update({
      where: { id: assetId },
      data: {
        accountType: toAccountType,
        status: toStatus,
        transferredToNote: dto.transferredToNote?.trim() || null,
        updatedById: actorId,
        logs: {
          create: {
            type: HospitalAssetLogType.TRANSFER,
            fromStatus: asset.status,
            toStatus,
            fromAccountType: asset.accountType,
            toAccountType,
            note: dto.note ?? dto.transferredToNote,
            createdBy: { connect: { id: actorId } },
          },
        },
      },
      include: assetInclude,
    });
  }

  async listAccess(actorId: string, accountType?: AccountType) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);
    const where: Prisma.HospitalAssetAccessGrantWhereInput = {};
    if (isHospitalWideInventoryRole(actor) && !accountType) {
      if (access.manageAccountTypes !== 'ALL') {
        throw new ForbiddenException(
          'Only the department head can manage this inventory.',
        );
      }
    } else {
      const scoped = this.defaultAccountType(actor, accountType);
      this.assertManage(access, scoped);
      where.accountType = scoped;
    }
    return this.prisma.hospitalAssetAccessGrant.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            staffId: true,
            firstName: true,
            lastName: true,
            staffRole: true,
            accountType: true,
          },
        },
        grantedBy: { select: staffBriefSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsertAccess(actorId: string, dto: UpsertHospitalAssetAccessDto) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);
    const accountType = this.defaultAccountType(actor, dto.accountType);
    this.assertManage(access, accountType);

    const target = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
      select: { id: true, accountType: true },
    });
    if (!target) throw new NotFoundException('Staff member not found.');
    if (target.accountType !== accountType) {
      throw new ForbiddenException(
        'Inventory access can only be granted to staff in that department.',
      );
    }

    const canLog = dto.canLog ?? false;
    const canView = canLog ? true : (dto.canView ?? true);

    return this.prisma.hospitalAssetAccessGrant.upsert({
      where: {
        staffId_accountType: { staffId: dto.staffId, accountType },
      },
      create: {
        staffId: dto.staffId,
        accountType,
        canView,
        canLog,
        grantedById: actorId,
      },
      update: {
        canView,
        canLog,
        grantedById: actorId,
      },
      include: {
        staff: {
          select: {
            id: true,
            staffId: true,
            firstName: true,
            lastName: true,
            staffRole: true,
          },
        },
      },
    });
  }

  async revokeAccess(actorId: string, grantId: string) {
    const actor = await this.loadActor(actorId);
    const access = await this.resolveAccess(actor);
    const grant = await this.prisma.hospitalAssetAccessGrant.findUnique({
      where: { id: grantId },
    });
    if (!grant) throw new NotFoundException('Access grant not found.');
    this.assertManage(access, grant.accountType);
    await this.prisma.hospitalAssetAccessGrant.delete({
      where: { id: grantId },
    });
  }
}
