import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, Prisma, ShiftType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';
import {
  headedAccountTypeForRole,
  isHospitalWideInventoryRole,
  usesGenericDepartmentRoster,
} from '../../common/constants/department-head.constants';
import {
  CreateDepartmentRosterDto,
  QueryDepartmentRosterDto,
  QueryDepartmentStaffDto,
  UpdateDepartmentRosterDto,
} from './dto/department-head.dto';

const rosterInclude = {
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
  assignedBy: { select: staffBriefSelect },
} as const;

const staffSelect = {
  id: true,
  staffId: true,
  firstName: true,
  lastName: true,
  staffRole: true,
  accountType: true,
  email: true,
  phone: true,
  isActive: true,
} as const;

type Actor = {
  id: string;
  accountType: AccountType;
  staffRole: string;
};

@Injectable()
export class DepartmentHeadService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeShiftDate(raw: string): Date {
    const d = new Date(raw);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private async loadActor(actorId: string): Promise<Actor> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: actorId },
      select: { id: true, accountType: true, staffRole: true },
    });
    if (!staff) throw new NotFoundException('Staff not found.');
    return staff;
  }

  private scopedAccountType(
    actor: Actor,
    requested?: AccountType,
  ): AccountType {
    if (isHospitalWideInventoryRole(actor)) {
      if (!requested) {
        throw new BadRequestException(
          'accountType query is required for hospital-wide staff views.',
        );
      }
      return requested;
    }
    const headed = headedAccountTypeForRole(
      actor.staffRole,
      actor.accountType,
    );
    if (!headed) {
      throw new ForbiddenException(
        'Only department heads may list department staff.',
      );
    }
    if (requested && requested !== headed) {
      throw new ForbiddenException(
        'You may only view staff in your own department.',
      );
    }
    return headed;
  }

  async listStaff(actorId: string, query: QueryDepartmentStaffDto) {
    const actor = await this.loadActor(actorId);
    const accountType = this.scopedAccountType(actor, query.accountType);
    return this.prisma.staff.findMany({
      where: {
        accountType,
        isActive: query.isActive ?? true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: staffSelect,
    });
  }

  async listRosters(actorId: string, query: QueryDepartmentRosterDto) {
    const actor = await this.loadActor(actorId);
    const accountType = this.scopedAccountType(actor, query.accountType);
    if (!usesGenericDepartmentRoster(accountType)) {
      throw new BadRequestException(
        'This department uses its own shift roster.',
      );
    }

    const where: Prisma.DepartmentShiftRosterWhereInput = { accountType };
    if (query.shiftDate) {
      where.shiftDate = this.normalizeShiftDate(query.shiftDate);
    }
    if (query.shiftType) where.shiftType = query.shiftType;

    return this.prisma.departmentShiftRoster.findMany({
      where,
      orderBy: [{ shiftDate: 'desc' }, { shiftType: 'asc' }],
      include: rosterInclude,
    });
  }

  async rosterSummary(actorId: string, query: QueryDepartmentRosterDto) {
    const actor = await this.loadActor(actorId);
    const accountType = this.scopedAccountType(actor, query.accountType);
    if (!usesGenericDepartmentRoster(accountType)) {
      throw new BadRequestException(
        'This department uses its own shift roster.',
      );
    }

    const shiftDate = query.shiftDate
      ? this.normalizeShiftDate(query.shiftDate)
      : (() => {
          const d = new Date();
          d.setUTCHours(0, 0, 0, 0);
          return d;
        })();

    const rows = await this.prisma.departmentShiftRoster.findMany({
      where: {
        accountType,
        shiftDate,
        ...(query.shiftType ? { shiftType: query.shiftType } : {}),
      },
      include: rosterInclude,
    });

    const byShift: Record<ShiftType, typeof rows> = {
      [ShiftType.MORNING]: [],
      [ShiftType.AFTERNOON]: [],
      [ShiftType.NIGHT]: [],
    };
    for (const row of rows) {
      byShift[row.shiftType].push(row);
    }

    return {
      shiftDate: shiftDate.toISOString(),
      accountType,
      morning: byShift.MORNING,
      afternoon: byShift.AFTERNOON,
      night: byShift.NIGHT,
      scheduled: rows.length,
    };
  }

  async createRoster(actorId: string, dto: CreateDepartmentRosterDto) {
    const actor = await this.loadActor(actorId);
    const accountType = this.scopedAccountType(actor, dto.accountType);
    if (!usesGenericDepartmentRoster(accountType)) {
      throw new BadRequestException(
        'This department uses its own shift roster.',
      );
    }

    const target = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
      select: { id: true, accountType: true, isActive: true },
    });
    if (!target) throw new NotFoundException('Staff member not found.');
    if (target.accountType !== accountType) {
      throw new BadRequestException(
        'Staff member is not in this department.',
      );
    }

    const shiftDate = this.normalizeShiftDate(dto.shiftDate);
    try {
      return await this.prisma.departmentShiftRoster.create({
        data: {
          staffId: dto.staffId,
          accountType,
          shiftDate,
          shiftType: dto.shiftType,
          assignedById: actorId,
          notes: dto.notes,
        },
        include: rosterInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'This staff member is already on the roster for that shift.',
        );
      }
      throw e;
    }
  }

  async updateRoster(
    actorId: string,
    rosterId: string,
    dto: UpdateDepartmentRosterDto,
  ) {
    const actor = await this.loadActor(actorId);
    const row = await this.prisma.departmentShiftRoster.findUnique({
      where: { id: rosterId },
    });
    if (!row) throw new NotFoundException('Roster entry not found.');
    this.scopedAccountType(actor, row.accountType);

    if (dto.staffId) {
      const target = await this.prisma.staff.findUnique({
        where: { id: dto.staffId },
        select: { accountType: true },
      });
      if (!target) throw new NotFoundException('Staff member not found.');
      if (target.accountType !== row.accountType) {
        throw new BadRequestException(
          'Staff member is not in this department.',
        );
      }
    }

    return this.prisma.departmentShiftRoster.update({
      where: { id: rosterId },
      data: {
        staffId: dto.staffId,
        shiftType: dto.shiftType,
        notes: dto.notes,
      },
      include: rosterInclude,
    });
  }

  async removeRoster(actorId: string, rosterId: string) {
    const actor = await this.loadActor(actorId);
    const row = await this.prisma.departmentShiftRoster.findUnique({
      where: { id: rosterId },
    });
    if (!row) throw new NotFoundException('Roster entry not found.');
    this.scopedAccountType(actor, row.accountType);
    await this.prisma.departmentShiftRoster.delete({ where: { id: rosterId } });
  }
}
