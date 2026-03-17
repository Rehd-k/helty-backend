import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateLabReportDto,
  UpdateLabReportDto,
} from './dto/create-lab-report.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class LabReportService {
  constructor(private prisma: PrismaService) {}

  async create(createLabReportDto: CreateLabReportDto) {
    if (createLabReportDto.encounterId) {
      await this.validateEncounterForPatient(
        createLabReportDto.encounterId,
        createLabReportDto.patientId,
      );
    }
    const { encounterId, ...rest } = createLabReportDto;
    return this.prisma.labReport.create({
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
      this.prisma.labReport.findMany({
        where: { date: { gte: from, lte: to } },
        skip,
        take,
        include: {
          patient: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.labReport.count({ where: { date: { gte: from, lte: to } } }),
    ]);

    return { reports, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.labReport.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.labReport.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        patient: true,
      },
    });
  }

  async update(id: string, updateLabReportDto: UpdateLabReportDto) {
    const existing = await this.prisma.labReport.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Lab report "${id}" not found.`);
    }
    if (updateLabReportDto.encounterId !== undefined) {
      await this.validateEncounterForPatient(
        updateLabReportDto.encounterId,
        existing.patientId,
      );
    }
    return this.prisma.labReport.update({
      where: { id },
      data: updateLabReportDto,
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
    return this.prisma.labReport.delete({
      where: { id },
    });
  }
}
