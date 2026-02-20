import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLabReportDto, UpdateLabReportDto } from './dto/create-lab-report.dto';

@Injectable()
export class LabReportService {
  constructor(private prisma: PrismaService) { }

  async create(createLabReportDto: CreateLabReportDto) {
    return this.prisma.labReport.create({
      data: { ...createLabReportDto, createdById: '' },

    });
  }

  async findAll(skip = 0, take = 10) {
    const [reports, total] = await Promise.all([
      this.prisma.labReport.findMany({
        skip,
        take,
        include: {
          patient: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.labReport.count(),
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
    return this.prisma.labReport.update({
      where: { id },
      data: updateLabReportDto,
    });
  }

  async remove(id: string) {
    return this.prisma.labReport.delete({
      where: { id },
    });
  }
}
