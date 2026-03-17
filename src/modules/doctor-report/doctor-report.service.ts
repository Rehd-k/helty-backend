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
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class DoctorReportService {
  constructor(private prisma: PrismaService) {}

  async create(createDoctorReportDto: CreateDoctorReportDto) {
    if (createDoctorReportDto.encounterId) {
      await this.validateEncounterForPatient(
        createDoctorReportDto.encounterId,
        createDoctorReportDto.patientId,
      );
    }
    const { encounterId, ...rest } = createDoctorReportDto;
    return this.prisma.doctorReport.create({
      data: {
        ...rest,
        ...(encounterId && { encounterId }),
        createdById: '',
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
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.doctorReport.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
      },
    });
  }

  async update(id: string, updateDoctorReportDto: UpdateDoctorReportDto) {
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
      data: updateDoctorReportDto,
    });
  }

  async findByEncounterId(encounterId: string) {
    return this.prisma.doctorReport.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: { patient: true, encounter: true },
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
