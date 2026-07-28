import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDoctorReportDto,
  UpdateDoctorReportDto,
} from './dto/create-doctor-report.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { resolveOrderingDoctorId } from '../encounter/encounter-inpatient-edit.util';
import { AdmissionStatus } from '@prisma/client';
import { parseDateRange } from '../../common/utils/date-range';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

@Injectable()
export class DoctorReportService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDoctorReportDto: CreateDoctorReportDto,
    actingStaffId: string,
  ) {
    let encounter:
      | {
          admissionId: string | null;
          admission?: { status: AdmissionStatus } | null;
        }
      | undefined;
    if (createDoctorReportDto.encounterId) {
      const loaded = await this.prisma.encounter.findUnique({
        where: { id: createDoctorReportDto.encounterId },
        select: {
          patientId: true,
          admissionId: true,
          admission: { select: { status: true } },
        },
      });
      if (!loaded) {
        throw new BadRequestException(
          `Encounter "${createDoctorReportDto.encounterId}" not found.`,
        );
      }
      if (loaded.patientId !== createDoctorReportDto.patientId) {
        throw new BadRequestException(
          'Encounter does not belong to the given patient.',
        );
      }
      encounter = loaded;
    }
    const { encounterId, doctorId, ...rest } = createDoctorReportDto;
    const resolvedDoctorId = encounter
      ? resolveOrderingDoctorId(
          encounter,
          actingStaffId,
          doctorId ?? actingStaffId,
        )
      : doctorId;
    return this.prisma.doctorReport.create({
      data: {
        ...rest,
        ...(encounterId && { encounterId }),
        ...(resolvedDoctorId && { doctorId: resolvedDoctorId }),
        createdById: actingStaffId,
      },
    });
  }

  async findAll(query: DateRangeSkipTakeDto) {
    const { skip = 0, take = 20, fromDate, toDate } = query;
    const { from, to } = parseDateRange(fromDate, toDate);
    const [reports, total] = await Promise.all([
      this.prisma.doctorReport.findMany({
        where: { createdAt: { gte: from, lte: to } },
        skip,
        take,
        include: {
          patient: true,
          createdBy: { select: staffBriefSelect },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.doctorReport.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
    ]);

    return { reports, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.doctorReport.findUnique({
      where: { id },
      include: {
        patient: true,
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.doctorReport.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  async update(
    id: string,
    updateDoctorReportDto: UpdateDoctorReportDto,
    staffId: string,
  ) {
    const existing = await this.prisma.doctorReport.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Doctor report "${id}" not found.`);
    }
    if (updateDoctorReportDto.encounterId !== undefined) {
      await this.validateEncounterForPatient(
        updateDoctorReportDto.encounterId,
        existing.patientId,
      );
    }
    return this.prisma.doctorReport.update({
      where: { id },
      data: { ...updateDoctorReportDto, updatedById: staffId },
      include: {
        updatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async findByEncounterId(encounterId: string) {
    return this.prisma.doctorReport.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        encounter: true,
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  private async validateEncounterForPatient(
    encounterId: string,
    patientId: string,
  ) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      throw new BadRequestException(`Encounter "${encounterId}" not found.`);
    }
    if (encounter.patientId !== patientId) {
      throw new BadRequestException(
        'Encounter does not belong to the given patient.',
      );
    }
  }

  async remove(id: string) {
    return this.prisma.doctorReport.delete({
      where: { id },
    });
  }
}
