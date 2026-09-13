import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PatientCycleFlow,
  PatientCyclePeriod,
  PatientCycleSettings,
  PregnancyStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  CreateCyclePeriodDto,
  CycleCalendarQueryDto,
  UpdateCyclePeriodDto,
  UpdateCycleSettingsDto,
} from './dto/patient-cycle.dto';
import {
  DEFAULT_CYCLE_LENGTH_DAYS,
  DEFAULT_PERIOD_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
} from './patient-cycle.constants';
import {
  autoCloseEndDate,
  averageCycleLengthDays,
  addDays,
  buildCycleStatus,
  canAutoCloseOpenPeriod,
  CyclePeriodInput,
  defaultSettingsDto,
  findOverlappingPeriod,
  hospitalTodayKey,
  monthRange,
  parseDateKey,
  periodLengthDays,
  predictedPeriodDays,
  toDateKey,
} from './patient-cycle.util';

type PeriodRow = Pick<
  PatientCyclePeriod,
  'id' | 'startDate' | 'endDate' | 'flow' | 'notes' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class PatientCycleService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: PatientJwtPayload) {
    const patientId = user.sub;
    const [settings, periods, pregnancyPaused] = await Promise.all([
      this.prisma.patientCycleSettings.findUnique({
        where: { patientId },
      }),
      this.listAllPeriods(patientId),
      this.hasOngoingPregnancy(patientId),
    ]);
    const configured = settings != null || periods.length > 0;
    const today = parseDateKey(hospitalTodayKey());
    const cycleLengthDays =
      settings?.cycleLengthDays ?? DEFAULT_CYCLE_LENGTH_DAYS;
    const periodLengthDaysValue =
      settings?.periodLengthDays ?? DEFAULT_PERIOD_LENGTH_DAYS;
    const status = configured
      ? buildCycleStatus({
          today,
          periods,
          cycleLengthDays,
          periodLengthDays: periodLengthDaysValue,
          pregnancyPaused,
        })
      : {
          headline: 'Log your last period to start tracking',
          cycleDay: null,
          daysUntilNext: null,
          nextPeriodStart: null,
          currentPeriodStart: null,
        };

    return {
      configured,
      pregnancyPaused,
      today: toDateKey(today),
      ...status,
    };
  }

  async getCalendar(user: PatientJwtPayload, query: CycleCalendarQueryDto) {
    const patientId = user.sub;
    const todayKey = hospitalTodayKey();
    const today = parseDateKey(todayKey);
    const year = query.year ?? today.getUTCFullYear();
    const month = query.month ?? today.getUTCMonth() + 1;
    const { start: monthStart, end: monthEnd } = monthRange(year, month);

    const [settings, monthPeriods, allPeriods, pregnancyPaused] =
      await Promise.all([
        this.prisma.patientCycleSettings.findUnique({
          where: { patientId },
        }),
        this.prisma.patientCyclePeriod.findMany({
          where: {
            patientId,
            startDate: { lte: monthEnd },
            OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
          },
          orderBy: { startDate: 'asc' },
        }),
        this.listAllPeriods(patientId),
        this.hasOngoingPregnancy(patientId),
      ]);

    const configured = settings != null || allPeriods.length > 0;
    const cycleLengthDays =
      settings?.cycleLengthDays ?? DEFAULT_CYCLE_LENGTH_DAYS;
    const periodLengthDaysValue =
      settings?.periodLengthDays ?? DEFAULT_PERIOD_LENGTH_DAYS;
    const status = buildCycleStatus({
      today,
      periods: allPeriods,
      cycleLengthDays,
      periodLengthDays: periodLengthDaysValue,
      pregnancyPaused,
    });

    const loggedRanges = allPeriods.map((period) => ({
      start: period.startDate,
      end: period.endDate ?? today,
    }));

    const lastStart =
      allPeriods.length > 0
        ? allPeriods[allPeriods.length - 1].startDate
        : null;
    const predictedDays =
      pregnancyPaused || !lastStart
        ? []
        : predictedPeriodDays({
            lastStart,
            cycleLengthDays: averageCycleLengthDays(
              allPeriods.map((period) => period.startDate),
              cycleLengthDays,
            ),
            periodLengthDays: periodLengthDaysValue,
            rangeStart: monthStart,
            rangeEnd: monthEnd,
            loggedRanges,
          });

    return {
      configured,
      pregnancyPaused,
      year,
      month,
      today: todayKey,
      settings: settings
        ? {
            cycleLengthDays: settings.cycleLengthDays,
            periodLengthDays: settings.periodLengthDays,
            isDefault: false as const,
          }
        : defaultSettingsDto(),
      periods: monthPeriods.map((period) => this.toPeriodDto(period)),
      predictedDays,
      ...status,
    };
  }

  async updateSettings(user: PatientJwtPayload, dto: UpdateCycleSettingsDto) {
    const patientId = user.sub;
    const settings = await this.prisma.patientCycleSettings.upsert({
      where: { patientId },
      create: {
        patientId,
        cycleLengthDays: dto.cycleLengthDays,
        periodLengthDays: dto.periodLengthDays,
      },
      update: {
        cycleLengthDays: dto.cycleLengthDays,
        periodLengthDays: dto.periodLengthDays,
      },
    });
    return this.toSettingsDto(settings);
  }

  async createPeriod(user: PatientJwtPayload, dto: CreateCyclePeriodDto) {
    const patientId = user.sub;
    const startDate = this.parseInputDate(dto.startDate, 'startDate');
    const endDate =
      dto.endDate == null
        ? null
        : this.parseInputDate(dto.endDate, 'endDate');
    this.assertPeriodLength(startDate, endDate);

    const existing = await this.listAllPeriods(patientId);
    const open = existing.find((period) => period.endDate == null);
    const autoClose =
      open && canAutoCloseOpenPeriod(open.startDate, startDate)
        ? {
            id: (open as PeriodRow & { id: string }).id,
            endDate: autoCloseEndDate(open.startDate, startDate),
          }
        : null;
    if (autoClose) {
      this.assertPeriodLength(open!.startDate, autoClose.endDate);
    }

    const remaining = autoClose
      ? existing.filter((period) => period.id !== autoClose.id)
      : existing;
    const overlap = findOverlappingPeriod(
      { start: startDate, end: endDate ?? addDays(startDate, 3650) },
      remaining,
    );
    if (overlap) {
      throw new ConflictException(
        'This date overlaps another logged period.',
      );
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.ensureSettings(tx, patientId);
        if (autoClose) {
          await tx.patientCyclePeriod.update({
            where: { id: autoClose.id },
            data: { endDate: autoClose.endDate },
          });
        }
        return tx.patientCyclePeriod.create({
          data: {
            patientId,
            startDate,
            endDate,
            flow: dto.flow,
            notes: dto.notes?.trim() || null,
          },
        });
      });
      return this.toPeriodDto(created);
    } catch (error) {
      this.rethrowUniqueStart(error);
      throw error;
    }
  }

  async updatePeriod(
    user: PatientJwtPayload,
    id: string,
    dto: UpdateCyclePeriodDto,
  ) {
    const current = await this.findOwnedPeriod(user.sub, id);
    const startDate =
      dto.startDate == null
        ? current.startDate
        : this.parseInputDate(dto.startDate, 'startDate');
    const endDate =
      dto.endDate === undefined
        ? current.endDate
        : dto.endDate == null
          ? null
          : this.parseInputDate(dto.endDate, 'endDate');
    this.assertPeriodLength(startDate, endDate);

    const existing = await this.listAllPeriods(user.sub);
    const overlap = findOverlappingPeriod(
      { start: startDate, end: endDate ?? addDays(startDate, 3650) },
      existing,
      { ignoreId: id },
    );
    if (overlap) {
      throw new ConflictException(
        'This date overlaps another logged period.',
      );
    }

    const data: Prisma.PatientCyclePeriodUpdateInput = {};
    if (dto.startDate !== undefined) data.startDate = startDate;
    if (dto.endDate !== undefined) data.endDate = endDate;
    if (dto.flow !== undefined) data.flow = dto.flow;
    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() ? dto.notes.trim() : null;
    }

    try {
      const updated = await this.prisma.patientCyclePeriod.update({
        where: { id },
        data,
      });
      return this.toPeriodDto(updated);
    } catch (error) {
      this.rethrowUniqueStart(error);
      throw error;
    }
  }

  async deletePeriod(user: PatientJwtPayload, id: string) {
    await this.findOwnedPeriod(user.sub, id);
    await this.prisma.patientCyclePeriod.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async listAllPeriods(patientId: string): Promise<
    Array<CyclePeriodInput & { id: string }>
  > {
    const rows = await this.prisma.patientCyclePeriod.findMany({
      where: { patientId },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      startDate: row.startDate,
      endDate: row.endDate,
    }));
  }

  private async hasOngoingPregnancy(patientId: string): Promise<boolean> {
    const pregnancy = await this.prisma.pregnancy.findFirst({
      where: { patientId, status: PregnancyStatus.ONGOING },
      select: { id: true },
    });
    return pregnancy != null;
  }

  private async findOwnedPeriod(patientId: string, id: string) {
    const period = await this.prisma.patientCyclePeriod.findFirst({
      where: { id, patientId },
    });
    if (!period) {
      throw new NotFoundException('Period not found.');
    }
    return period;
  }

  private async ensureSettings(
    tx: Prisma.TransactionClient,
    patientId: string,
  ) {
    await tx.patientCycleSettings.upsert({
      where: { patientId },
      create: {
        patientId,
        cycleLengthDays: DEFAULT_CYCLE_LENGTH_DAYS,
        periodLengthDays: DEFAULT_PERIOD_LENGTH_DAYS,
      },
      update: {},
    });
  }

  private parseInputDate(value: string, field: string): Date {
    try {
      return parseDateKey(value);
    } catch {
      throw new BadRequestException(`${field} must be YYYY-MM-DD`);
    }
  }

  private assertPeriodLength(start: Date, end: Date | null) {
    if (!end) return;
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('endDate cannot be before startDate.');
    }
    if (periodLengthDays(start, end) > MAX_PERIOD_LENGTH_DAYS) {
      throw new BadRequestException(
        `Period cannot be longer than ${MAX_PERIOD_LENGTH_DAYS} days.`,
      );
    }
  }

  private rethrowUniqueStart(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A period already starts on this date.',
      );
    }
  }

  private toPeriodDto(period: PeriodRow) {
    return {
      id: period.id,
      startDate: toDateKey(period.startDate),
      endDate: period.endDate ? toDateKey(period.endDate) : null,
      flow: period.flow as PatientCycleFlow | null,
      notes: period.notes,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    };
  }

  private toSettingsDto(settings: PatientCycleSettings) {
    return {
      cycleLengthDays: settings.cycleLengthDays,
      periodLengthDays: settings.periodLengthDays,
      isDefault: false as const,
    };
  }
}
