import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/create-appointment.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class AppointmentService {
  constructor(private prisma: PrismaService) {}

  async create(createAppointmentDto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        patientId: createAppointmentDto.patientId,
        date: new Date(createAppointmentDto.date),
        status: createAppointmentDto.status,
        notes: createAppointmentDto.notes,
        createdById: '',
      },
    });
  }

  async findAll(query: DateRangeSkipTakeDto) {
    const { skip = 0, take = 20, fromDate, toDate } = query;
    const { from, to } = parseDateRange(fromDate, toDate);
    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { date: { gte: from, lte: to } },
        skip,
        take,
        include: {
          patient: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.appointment.count({
        where: { date: { gte: from, lte: to } },
      }),
    ]);

    return { appointments, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        patient: true,
      },
    });
  }

  async getUpcomingAppointments() {
    const today = new Date();
    return this.prisma.appointment.findMany({
      where: {
        date: {
          gte: today,
        },
        status: { in: ['scheduled', 'rescheduled'] },
      },
      include: {
        patient: true,
      },
      orderBy: { date: 'asc' },
    });
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto) {
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...(updateAppointmentDto.date && {
          date: new Date(updateAppointmentDto.date),
        }),
        status: updateAppointmentDto.status,
        notes: updateAppointmentDto.notes,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.appointment.delete({
      where: { id },
    });
  }
}
