import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountType, Prisma, StaffRole } from '@prisma/client';
import { activeStaffPasswordResetInclude } from './staff-password-reset.query';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { validateStaffRolePairing } from './staff-role.validation';
import {
  isChargeNurseRole,
  staffRoleToNursingUnit,
} from '../nursing/nursing.constants';
import { wardMatchesNursingUnit } from '../nursing/nursing-scope.utils';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) { }

  private extractRelationId(
    directId: string | null | undefined,
    relation: unknown,
  ): string | undefined {
    if (directId !== undefined && directId !== null) {
      return directId;
    }
    if (
      relation &&
      typeof relation === 'object' &&
      'connect' in relation &&
      (relation as { connect?: { id: string } }).connect?.id
    ) {
      return (relation as { connect: { id: string } }).connect.id;
    }
    return undefined;
  }

  private async validateChargeNurseWard(
    staffRole: StaffRole,
    wardId: string | undefined,
  ): Promise<void> {
    if (!isChargeNurseRole(staffRole)) return;
    if (!wardId) return;

    const nursingUnit = staffRoleToNursingUnit(staffRole);
    if (!nursingUnit) return;

    const ward = await this.prisma.ward.findUnique({
      where: { id: wardId },
      select: {
        id: true,
        type: true,
        name: true,
        department: { select: { name: true } },
      },
    });
    if (!ward) {
      throw new BadRequestException(`Ward "${wardId}" not found.`);
    }
    if (!wardMatchesNursingUnit(ward, nursingUnit)) {
      throw new BadRequestException(
        `Ward "${ward.name}" does not belong to the ${nursingUnit} nursing unit.`,
      );
    }
  }

  async create(data: Prisma.StaffCreateInput) {
    // hash password if provided
    if ('password' in data && data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    if ('role' in data) {
      delete data.role;
    }

    const createData = data as Prisma.StaffCreateInput & {
      accountType?: AccountType;
      staffRole?: StaffRole;
      departmentId?: string;
      wardId?: string;
    };
    if (createData.accountType && createData.staffRole) {
      const departmentId = this.extractRelationId(
        createData.departmentId,
        createData.department,
      );
      const wardId = this.extractRelationId(createData.wardId, createData.ward);
      validateStaffRolePairing({
        accountType: createData.accountType,
        staffRole: createData.staffRole,
        departmentId,
        wardId,
      });
      await this.validateChargeNurseWard(createData.staffRole, wardId);
    }

    const newStaff = await this.prisma.staff.create({ data: data as any });
    return newStaff;
  }

  private buildStaffSearchWhere(q: string): Prisma.StaffWhereInput {
    const term = q.trim();
    const lowered = term.toLowerCase();
    const accountTypes = Object.values(AccountType).filter((v) =>
      v.toLowerCase().includes(lowered),
    );
    const staffRoles = Object.values(StaffRole).filter((v) =>
      v.toLowerCase().includes(lowered),
    );

    const or: Prisma.StaffWhereInput[] = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { staffId: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
      { department: { name: { contains: term, mode: 'insensitive' } } },
      { ward: { name: { contains: term, mode: 'insensitive' } } },
    ];

    if (accountTypes.length) {
      or.push({ accountType: { in: accountTypes } });
    }
    if (staffRoles.length) {
      or.push({ staffRole: { in: staffRoles } });
    }

    return { OR: or };
  }

  async findAll(query: ListStaffQueryDto = {}) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.limit ?? 20), 500);
    const skip = (page - 1) * pageSize;

    const filters: Prisma.StaffWhereInput = {};
    if (query.accountType) filters.accountType = query.accountType;
    if (query.isActive !== undefined) filters.isActive = query.isActive;

    const where: Prisma.StaffWhereInput = query.q?.trim()
      ? { AND: [this.buildStaffSearchWhere(query.q), filters] }
      : Object.keys(filters).length
        ? filters
        : {};

    const [data, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          department: true,
          ward: { select: { id: true, name: true, type: true } },
          createdBy: { select: staffBriefSelect },
        },
        omit: { password: true },
      }),
      this.prisma.staff.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findById(id: string) {
    const user = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        department: true,
        ward: { select: { id: true, name: true, type: true } },
        headedDepartment: true,
        passwordResets: activeStaffPasswordResetInclude(),
        createdBy: { select: staffBriefSelect },
        updatedBy: { select: staffBriefSelect },
      },
    });
    if (!user) throw new NotFoundException('Staff member not found');
    return user;
  }

  async findByEmail(email: string) {
    if (!email) return null;
    return this.prisma.staff.findUnique({
      where: { email },
      include: {
        department: true,
        ward: { select: { id: true, name: true, type: true } },
        headedDepartment: true,
      },
    });
  }

  /** Active staff with non-null email (case-insensitive), for password reset. */
  async findActiveByEmailForPasswordReset(email: string) {
    const trimmed = email?.trim() ?? '';
    if (!trimmed || !trimmed.includes('@')) return null;
    return this.prisma.staff.findFirst({
      where: {
        email: { equals: trimmed, mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true, email: true },
    });
  }

  private staffAuthInclude = {
    department: true,
    ward: { select: { id: true, name: true, type: true } },
    headedDepartment: true,
  } as const;

  /**
   * Resolve staff for login: if the value contains `@`, match email (case-insensitive);
   * otherwise treat as phone and match after stripping non-digits from both sides.
   */
  async findByEmailOrPhone(identifier: string) {
    const trimmed = identifier?.trim() ?? '';
    if (!trimmed) return null;

    if (trimmed.includes('@')) {
      return this.prisma.staff.findFirst({
        where: {
          email: { equals: trimmed, mode: 'insensitive' },
        },
        include: this.staffAuthInclude,
      });
    }

    const digits = trimmed.replace(/\D/g, '');
    if (!digits || digits.length < 5) return null;

    const matches = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT "id" FROM "Staff"
        WHERE "phone" IS NOT NULL
          AND regexp_replace("phone", '[^0-9]', '', 'g') = ${digits}
        LIMIT 2
      `,
    );

    if (matches.length !== 1) return null;

    return this.prisma.staff.findUnique({
      where: { id: matches[0].id },
      include: this.staffAuthInclude,
    });
  }

  async update(
    id: string,
    data: Partial<any>,
    updatedByStaffId?: string,
  ) {
    const existing = await this.prisma.staff.findUnique({
      where: { id },
      select: {
        accountType: true,
        staffRole: true,
        departmentId: true,
        wardId: true,
      },
    });
    if (!existing) throw new NotFoundException('Staff member not found');

    const payload: Record<string, unknown> = { ...data };
    if (updatedByStaffId) {
      payload.updatedBy = { connect: { id: updatedByStaffId } };
    }

    const accountType = (payload.accountType as AccountType) ?? existing.accountType;
    const staffRole = (payload.staffRole as StaffRole) ?? existing.staffRole;
    let departmentId = existing.departmentId;
    if (payload.departmentId !== undefined) {
      departmentId = payload.departmentId as string | null;
    } else if (payload.department && typeof payload.department === 'object') {
      const conn = payload.department as { connect?: { id: string } };
      if (conn.connect?.id) departmentId = conn.connect.id;
    }

    let wardId = existing.wardId;
    if (payload.wardId !== undefined) {
      wardId = payload.wardId as string | null;
    } else if (payload.ward && typeof payload.ward === 'object') {
      const conn = payload.ward as { connect?: { id: string } };
      if (conn.connect?.id) wardId = conn.connect.id;
    }

    validateStaffRolePairing({ accountType, staffRole, departmentId, wardId });
    await this.validateChargeNurseWard(staffRole, wardId ?? undefined);

    return this.prisma.staff.update({ where: { id }, data: payload as any });
  }

  async remove(id: string) {
    return this.prisma.staff.delete({ where: { id } });
  }
}

