import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRadiologyReportDto,
  UpdateRadiologyReportDto,
} from './dto/create-radiology-report.dto';

@Injectable()
export class RadiologyReportService {
  constructor(private prisma: PrismaService) {}

  async create(createRadiologyReportDto: CreateRadiologyReportDto) {
    if (createRadiologyReportDto.encounterId) {
      await this.validateEncounterForPatient(
        createRadiologyReportDto.encounterId,
        createRadiologyReportDto.patientId,
      );
    }
    const { encounterId, ...rest } = createRadiologyReportDto;
    return this.prisma.radiologyReport.create({
      data: {
        ...rest,
        ...(encounterId && { encounterId }),
        createdById: '',
      },
    });
  }

  async findAll(skip = 0, take = 10) {
    const [reports, total] = await Promise.all([
      this.prisma.radiologyReport.findMany({
        skip,
        take,
        include: {
          patient: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.radiologyReport.count(),
    ]);

    return { reports, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.radiologyReport.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.radiologyReport.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        patient: true,
      },
    });
  }

  async update(id: string, updateRadiologyReportDto: UpdateRadiologyReportDto) {
    const existing = await this.prisma.radiologyReport.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Radiology report "${id}" not found.`);
    }
    if (updateRadiologyReportDto.encounterId !== undefined) {
      await this.validateEncounterForPatient(
        updateRadiologyReportDto.encounterId,
        existing.patientId,
      );
    }
    return this.prisma.radiologyReport.update({
      where: { id },
      data: updateRadiologyReportDto,
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
    return this.prisma.radiologyReport.delete({
      where: { id },
    });
  }
}
