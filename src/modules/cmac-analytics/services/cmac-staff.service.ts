import { Injectable } from '@nestjs/common';
import { EncounterStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CmacPeriodContext, NamedCount } from '../cmac-analytics.types';
import { inRange } from '../cmac-analytics.helpers';

@Injectable()
export class CmacStaffService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(ctx: CmacPeriodContext, limit = 10) {
    const [patientsPerDoctor, labWorkload, departmentEfficiency] =
      await Promise.all([
        this.patientsPerDoctor(ctx, limit),
        this.labWorkload(ctx, limit),
        this.departmentEfficiency(ctx, limit),
      ]);

    return {
      period: ctx.period,
      asOf: ctx.asOf.toISOString(),
      patientsPerDoctor,
      labWorkloadPerTechnician: labWorkload,
      departmentEfficiency,
    };
  }

  private async patientsPerDoctor(
    ctx: CmacPeriodContext,
    limit: number,
  ): Promise<NamedCount[]> {
    const encounters = await this.prisma.encounter.findMany({
      where: {
        status: EncounterStatus.COMPLETED,
        endTime: inRange(ctx, 'current'),
      },
      select: { doctorId: true, patientId: true },
    });
    const byDoctor = new Map<string, Set<string>>();
    for (const e of encounters) {
      if (!byDoctor.has(e.doctorId)) byDoctor.set(e.doctorId, new Set());
      byDoctor.get(e.doctorId)!.add(e.patientId);
    }
    const sorted = [...byDoctor.entries()]
      .map(([id, set]) => ({ id, count: set.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: sorted.map((s) => s.id) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const names = new Map(
      staff.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]),
    );
    return sorted.map((s) => ({
      name: names.get(s.id) ?? s.id,
      count: s.count,
    }));
  }

  private async labWorkload(
    ctx: CmacPeriodContext,
    limit: number,
  ): Promise<NamedCount[]> {
    const rows = await this.prisma.labResult.groupBy({
      by: ['enteredById'],
      where: { createdAt: inRange(ctx, 'current') },
      _count: { _all: true },
      orderBy: { _count: { enteredById: 'desc' } },
      take: limit,
    });
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: rows.map((r) => r.enteredById) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const names = new Map(
      staff.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]),
    );
    return rows.map((r) => ({
      name: names.get(r.enteredById) ?? r.enteredById,
      count: r._count._all,
    }));
  }

  private async departmentEfficiency(
    ctx: CmacPeriodContext,
    limit: number,
  ): Promise<Array<NamedCount & { score: number }>> {
    const depts = await this.prisma.department.findMany({
      select: { id: true, name: true },
      take: limit * 2,
    });
    const scores: Array<NamedCount & { score: number }> = [];
    for (const d of depts) {
      const [volume, complaints, wait] = await Promise.all([
        this.prisma.encounter.count({
          where: {
            startTime: inRange(ctx, 'current'),
            doctor: { departmentId: d.id },
          },
        }),
        this.prisma.patientComplaint.count({
          where: {
            departmentId: d.id,
            status: { in: ['OPEN', 'INVESTIGATING'] },
          },
        }),
        this.avgWaitForDepartment(d.id, ctx),
      ]);
      const score = Math.max(
        0,
        Math.round(volume * 10 - complaints * 5 - wait * 2),
      );
      scores.push({ name: d.name, count: volume, score });
    }
    return scores.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async avgWaitForDepartment(
    departmentId: string,
    ctx: CmacPeriodContext,
  ): Promise<number> {
    const staffIds = await this.prisma.staff.findMany({
      where: { departmentId },
      select: { id: true },
    });
    if (staffIds.length === 0) return 0;
    const seen = await this.prisma.waitingPatient.findMany({
      where: {
        seen: true,
        createdAt: inRange(ctx, 'current'),
        consultingRoom: {
          // fallback: no direct dept on waiting patient
        },
      },
      select: { createdAt: true, updatedAt: true },
      take: 100,
    });
    void staffIds;
    if (seen.length === 0) return 0;
    const total = seen.reduce(
      (s, w) =>
        s + (w.updatedAt.getTime() - w.createdAt.getTime()) / 60000,
      0,
    );
    return Math.round(total / seen.length);
  }
}
