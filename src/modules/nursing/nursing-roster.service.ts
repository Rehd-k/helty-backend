import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertTargetStaffIsNurseOrThrow } from '../inpatient-nursing/inpatient-nursing.utils';
import {
  assertActorCanManageRoster,
  assertCanManageNursingUnit,
  assertCanManageWard,
  loadNursingActor,
  NursingActor,
  wardMatchesNursingUnit,
} from './nursing-scope.utils';
import {
  CreateNurseShiftRosterDto,
  QueryNurseShiftRosterDto,
  UpdateNurseShiftRosterDto,
} from './dto/nursing-roster.dto';
import { isMatronRole, staffRoleToNursingUnit } from './nursing.constants';

const rosterInclude = {
  nurse: {
    select: { id: true, firstName: true, lastName: true, staffRole: true },
  },
  ward: { select: { id: true, name: true, type: true } },
  department: { select: { id: true, name: true } },
  assignedBy: {
    select: { id: true, firstName: true, lastName: true, staffRole: true },
  },
} as const;

@Injectable()
export class NursingRosterService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeShiftDate(raw: string): Date {
    const d = new Date(raw);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private async scopeWhere(
    actor: NursingActor,
    query: QueryNurseShiftRosterDto,
  ): Promise<Prisma.NurseShiftRosterWhereInput> {
    const where: Prisma.NurseShiftRosterWhereInput = {};

    if (query.nursingUnit) {
      assertCanManageNursingUnit(actor, query.nursingUnit);
      where.nursingUnit = query.nursingUnit;
    } else if (!isMatronRole(actor.staffRole)) {
      const unit = staffRoleToNursingUnit(actor.staffRole);
      if (unit) where.nursingUnit = unit;
    }

    if (query.wardId) {
      await assertCanManageWard(this.prisma, actor, query.wardId);
      where.wardId = query.wardId;
    }

    if (query.shiftDate) {
      where.shiftDate = this.normalizeShiftDate(query.shiftDate);
    }
    if (query.shiftType) {
      where.shiftType = query.shiftType;
    }

    return where;
  }

  async list(actorId: string, query: QueryNurseShiftRosterDto) {
    const actor = await loadNursingActor(this.prisma, actorId);
    const where = await this.scopeWhere(actor, query);

    return this.prisma.nurseShiftRoster.findMany({
      where,
      orderBy: [{ shiftDate: 'desc' }, { shiftType: 'asc' }],
      include: rosterInclude,
    });
  }

  async summary(actorId: string, query: QueryNurseShiftRosterDto) {
    const actor = await loadNursingActor(this.prisma, actorId);
    const where = await this.scopeWhere(actor, query);
    const shiftDate =
      query.shiftDate != null
        ? this.normalizeShiftDate(query.shiftDate)
        : (() => {
            const d = new Date();
            d.setUTCHours(0, 0, 0, 0);
            return d;
          })();

    const rosterWhere: Prisma.NurseShiftRosterWhereInput = {
      ...where,
      shiftDate,
    };

    const [scheduled, rosterRows] = await Promise.all([
      this.prisma.nurseShiftRoster.count({ where: rosterWhere }),
      this.prisma.nurseShiftRoster.findMany({
        where: rosterWhere,
        select: { nurseId: true },
      }),
    ]);

    const nurseIds = [...new Set(rosterRows.map((r) => r.nurseId))];
    const since = new Date(Date.now() - 8 * 60 * 60 * 1000);
    let onDuty = 0;
    if (nurseIds.length) {
      onDuty = await this.prisma.patientVitals.groupBy({
        by: ['recordedByNurseId'],
        where: {
          recordedByNurseId: { in: nurseIds },
          recordedAt: { gte: since },
        },
      }).then((g) => g.length);
    }

    return {
      shiftDate: shiftDate.toISOString(),
      scheduled,
      onDuty,
      coverageGap: Math.max(0, scheduled - onDuty),
    };
  }

  async create(actorId: string, dto: CreateNurseShiftRosterDto) {
    const actor = await loadNursingActor(this.prisma, actorId);
    assertActorCanManageRoster(actor);
    assertCanManageNursingUnit(actor, dto.nursingUnit);

    let rosterDepartmentId = dto.departmentId;
    if (dto.wardId) {
      const { ward } = await assertCanManageWard(
        this.prisma,
        actor,
        dto.wardId,
      );
      const fullWard = await this.prisma.ward.findUnique({
        where: { id: ward.id },
        select: {
          departmentId: true,
          type: true,
          name: true,
          department: { select: { name: true } },
        },
      });
      if (
        fullWard &&
        !wardMatchesNursingUnit(fullWard, dto.nursingUnit)
      ) {
        throw new BadRequestException(
          'Ward does not belong to the selected nursing unit.',
        );
      }
      if (!rosterDepartmentId && fullWard?.departmentId) {
        rosterDepartmentId = fullWard.departmentId;
      }
    }

    await assertTargetStaffIsNurseOrThrow(this.prisma, dto.nurseId);

    const shiftDate = this.normalizeShiftDate(dto.shiftDate);

    try {
      return await this.prisma.nurseShiftRoster.create({
        data: {
          nurseId: dto.nurseId,
          nursingUnit: dto.nursingUnit,
          wardId: dto.wardId,
          departmentId: rosterDepartmentId ?? undefined,
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
          'This nurse is already on the roster for that unit, shift, and ward.',
        );
      }
      throw e;
    }
  }

  async update(
    actorId: string,
    rosterId: string,
    dto: UpdateNurseShiftRosterDto,
  ) {
    const actor = await loadNursingActor(this.prisma, actorId);
    assertActorCanManageRoster(actor);

    const row = await this.prisma.nurseShiftRoster.findUnique({
      where: { id: rosterId },
    });
    if (!row) throw new NotFoundException('Roster entry not found.');

    assertCanManageNursingUnit(actor, row.nursingUnit);
    if (row.wardId) {
      await assertCanManageWard(this.prisma, actor, row.wardId);
    }

    if (dto.nurseId) {
      await assertTargetStaffIsNurseOrThrow(this.prisma, dto.nurseId);
    }

    return this.prisma.nurseShiftRoster.update({
      where: { id: rosterId },
      data: {
        nurseId: dto.nurseId,
        notes: dto.notes,
      },
      include: rosterInclude,
    });
  }

  async remove(actorId: string, rosterId: string) {
    const actor = await loadNursingActor(this.prisma, actorId);
    assertActorCanManageRoster(actor);

    const row = await this.prisma.nurseShiftRoster.findUnique({
      where: { id: rosterId },
    });
    if (!row) throw new NotFoundException('Roster entry not found.');

    assertCanManageNursingUnit(actor, row.nursingUnit);
    if (row.wardId) {
      await assertCanManageWard(this.prisma, actor, row.wardId);
    }

    await this.prisma.nurseShiftRoster.delete({ where: { id: rosterId } });
  }
}
