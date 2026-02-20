import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRadiologyReportDto, UpdateRadiologyReportDto } from './dto/create-radiology-report.dto';

@Injectable()
export class RadiologyReportService {
  constructor(private prisma: PrismaService) { }

  async create(createRadiologyReportDto: CreateRadiologyReportDto) {
    return this.prisma.radiologyReport.create({
      data: { ...createRadiologyReportDto, createdById: '', },
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
    return this.prisma.radiologyReport.update({
      where: { id },
      data: updateRadiologyReportDto,
    });
  }

  async remove(id: string) {
    return this.prisma.radiologyReport.delete({
      where: { id },
    });
  }
}
