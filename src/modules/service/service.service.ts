import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';

@Injectable()
export class ServiceService {
  constructor(private prisma: PrismaService) { }

  async create(createServiceDto: CreateServiceDto, req) {
    return this.prisma.service.create({
      data: { ...createServiceDto, createdById: req.user.sub, },
    });
  }

  async findAll(skip = 0, take = 10) {
    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        skip,
        take,
        include: {
          patientServices: {
            include: {
              patient: {
                select: {
                  id: true,
                  patientId: true,
                  firstName: true,
                  surname: true,
                },
              },
            },
          },
          category: true,
          department: true,
        },
      }),
      this.prisma.service.count(),
    ]);

    return { services, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.service.findUnique({
      where: { id },
      include: {
        patientServices: {
          include: {
            patient: true,
          },
        },
        category: true,
        department: true,
      },
    });
  }

  async update(id: string, updateServiceDto: UpdateServiceDto) {
    return this.prisma.service.update({
      where: { id },
      data: updateServiceDto,
    });
  }

  async remove(id: string) {
    return this.prisma.service.delete({
      where: { id },
    });
  }

  async addServiceToPatient(patientId: string, serviceId: string, quantity: number = 1) {
    return this.prisma.patientService.create({
      data: {
        patientId,
        serviceId,
        quantity,
        createdById: '',
      },
      include: {
        service: true,
        patient: true,
      },
    });
  }

  async getPatientServices(patientId: string) {
    return this.prisma.patientService.findMany({
      where: { patientId },
      include: {
        service: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async removePatientService(patientServiceId: string) {
    return this.prisma.patientService.delete({
      where: { id: patientServiceId },
    });
  }
}
