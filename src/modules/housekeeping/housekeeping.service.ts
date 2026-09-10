import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';
import {
  AssignHousekeepingAreaDto,
  CreateHousekeepingAreaDto,
  CreateHousekeepingShiftDto,
  CreateHousekeepingSupplyLogDto,
  CreateHousekeepingWorkerDto,
  QueryHousekeepingShiftDto,
  UpdateHousekeepingAreaDto,
  UpdateHousekeepingWorkerDto,
} from './dto/housekeeping.dto';

const workerInclude = {
  assignments: {
    include: {
      area: { select: { id: true, name: true, kind: true, isActive: true } },
    },
  },
} as const;

const areaInclude = {
  ward: { select: { id: true, name: true } },
  consultingRoom: { select: { id: true, name: true } },
  theatreRoom: { select: { id: true, name: true } },
} as const;

@Injectable()
export class HousekeepingService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeShiftDate(raw: string): Date {
    const d = new Date(raw);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  listWorkers() {
    return this.prisma.housekeepingWorker.findMany({
      orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }],
      include: workerInclude,
    });
  }

  async getWorker(id: string) {
    const worker = await this.prisma.housekeepingWorker.findUnique({
      where: { id },
      include: {
        ...workerInclude,
        shifts: { orderBy: { shiftDate: 'desc' }, take: 14 },
      },
    });
    if (!worker) throw new NotFoundException('Worker not found.');
    return worker;
  }

  createWorker(actorId: string, dto: CreateHousekeepingWorkerDto) {
    return this.prisma.housekeepingWorker.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        notes: dto.notes,
        createdById: actorId,
      },
      include: workerInclude,
    });
  }

  async updateWorker(
    actorId: string,
    id: string,
    dto: UpdateHousekeepingWorkerDto,
  ) {
    await this.getWorker(id);
    return this.prisma.housekeepingWorker.update({
      where: { id },
      data: { ...dto, updatedById: actorId },
      include: workerInclude,
    });
  }

  listAreas() {
    return this.prisma.housekeepingArea.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        ...areaInclude,
        assignments: {
          include: {
            worker: {
              select: { id: true, firstName: true, lastName: true, isActive: true },
            },
          },
        },
      },
    });
  }

  async createArea(actorId: string, dto: CreateHousekeepingAreaDto) {
    return this.prisma.housekeepingArea.create({
      data: {
        name: dto.name,
        kind: dto.kind,
        notes: dto.notes,
        wardId: dto.wardId,
        consultingRoomId: dto.consultingRoomId,
        theatreRoomId: dto.theatreRoomId,
        createdById: actorId,
      },
      include: areaInclude,
    });
  }

  async updateArea(
    actorId: string,
    id: string,
    dto: UpdateHousekeepingAreaDto,
  ) {
    const area = await this.prisma.housekeepingArea.findUnique({
      where: { id },
    });
    if (!area) throw new NotFoundException('Area not found.');
    return this.prisma.housekeepingArea.update({
      where: { id },
      data: { ...dto, updatedById: actorId },
      include: areaInclude,
    });
  }

  async assignArea(
    workerId: string,
    dto: AssignHousekeepingAreaDto,
  ) {
    const worker = await this.prisma.housekeepingWorker.findUnique({
      where: { id: workerId },
    });
    if (!worker) throw new NotFoundException('Worker not found.');
    const area = await this.prisma.housekeepingArea.findUnique({
      where: { id: dto.areaId },
    });
    if (!area) throw new NotFoundException('Area not found.');
    try {
      return await this.prisma.housekeepingAssignment.create({
        data: { workerId, areaId: dto.areaId },
        include: {
          area: { select: { id: true, name: true, kind: true } },
          worker: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('Worker is already assigned to this area.');
      }
      throw e;
    }
  }

  async unassignArea(workerId: string, areaId: string) {
    const row = await this.prisma.housekeepingAssignment.findUnique({
      where: { workerId_areaId: { workerId, areaId } },
    });
    if (!row) throw new NotFoundException('Assignment not found.');
    await this.prisma.housekeepingAssignment.delete({
      where: { id: row.id },
    });
  }

  async listShifts(query: QueryHousekeepingShiftDto) {
    const where: Prisma.HousekeepingShiftRosterWhereInput = {};
    if (query.shiftDate) {
      where.shiftDate = this.normalizeShiftDate(query.shiftDate);
    }
    if (query.shiftType) where.shiftType = query.shiftType;
    if (query.workerId) where.workerId = query.workerId;
    return this.prisma.housekeepingShiftRoster.findMany({
      where,
      orderBy: [{ shiftDate: 'desc' }, { shiftType: 'asc' }],
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true, isActive: true },
        },
        assignedBy: { select: staffBriefSelect },
      },
    });
  }

  async shiftSummary(query: QueryHousekeepingShiftDto) {
    const shiftDate = query.shiftDate
      ? this.normalizeShiftDate(query.shiftDate)
      : (() => {
          const d = new Date();
          d.setUTCHours(0, 0, 0, 0);
          return d;
        })();
    const rows = await this.prisma.housekeepingShiftRoster.findMany({
      where: { shiftDate },
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true, isActive: true },
        },
      },
    });
    return {
      shiftDate: shiftDate.toISOString(),
      morning: rows.filter((r) => r.shiftType === 'MORNING'),
      afternoon: rows.filter((r) => r.shiftType === 'AFTERNOON'),
      night: rows.filter((r) => r.shiftType === 'NIGHT'),
      scheduled: rows.length,
    };
  }

  async createShift(actorId: string, dto: CreateHousekeepingShiftDto) {
    const worker = await this.prisma.housekeepingWorker.findUnique({
      where: { id: dto.workerId },
    });
    if (!worker) throw new NotFoundException('Worker not found.');
    try {
      return await this.prisma.housekeepingShiftRoster.create({
        data: {
          workerId: dto.workerId,
          shiftDate: this.normalizeShiftDate(dto.shiftDate),
          shiftType: dto.shiftType,
          assignedById: actorId,
          notes: dto.notes,
        },
        include: {
          worker: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'This worker is already on that shift.',
        );
      }
      throw e;
    }
  }

  async removeShift(id: string) {
    const row = await this.prisma.housekeepingShiftRoster.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Shift entry not found.');
    await this.prisma.housekeepingShiftRoster.delete({ where: { id } });
  }

  listSupplyLogs() {
    return this.prisma.housekeepingSupplyLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true },
        },
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  createSupplyLog(actorId: string, dto: CreateHousekeepingSupplyLogDto) {
    return this.prisma.housekeepingSupplyLog.create({
      data: {
        itemName: dto.itemName,
        quantity: dto.quantity,
        unit: dto.unit,
        action: dto.action,
        workerId: dto.workerId,
        note: dto.note,
        createdById: actorId,
      },
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true },
        },
        createdBy: { select: staffBriefSelect },
      },
    });
  }
}
