import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDoctorReportDto, UpdateDoctorReportDto } from './dto/create-doctor-report.dto';

@Injectable()
export class DoctorReportService {
  constructor(private prisma: PrismaService) {}

  async create(createDoctorReportDto: CreateDoctorReportDto) {
    return this.prisma.doctorReport.create({
      data: {...createDoctorReportDto, createdById: ''},
    });
  }

  async findAll(skip = 0, take = 10) {
    const [reports, total] = await Promise.all([
      this.prisma.doctorReport.findMany({
        skip,
        take,
        include: {
          patient: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.doctorReport.count(),
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
    return this.prisma.doctorReport.update({
      where: { id },
      data: updateDoctorReportDto,
    });
  }

  async remove(id: string) {
    return this.prisma.doctorReport.delete({
      where: { id },
    });
  }
}
