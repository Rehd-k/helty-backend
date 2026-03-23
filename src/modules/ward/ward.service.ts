import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';

@Injectable()
export class WardService {
  constructor(private readonly prisma: PrismaService) { }

  createWard(dto: CreateWardDto) {
    return this.prisma.ward.create({
      data: {
        name: dto.name,
        capacity: dto.capacity,
        type: dto.type,
        departmentId: dto.departmentId ?? null,
      },
    });
  }

  findAllWards() {
    return this.prisma.ward.findMany({
      orderBy: { name: 'asc' },
      include: {
        beds: true,
      },
    });
  }

  async findWardById(id: string) {
    const ward = await this.prisma.ward.findUnique({
      where: { id },
      include: {
        beds: true,
        admissions: {
          where: { status: 'ACTIVE' },

          include: {
            encounter: {
              include: {
                patient: {
                  select: {
                    firstName: true,
                    surname: true,
                    patientId: true,
                  }
                },
                doctor: {
                  select: {
                    firstName: true,
                    lastName: true,
                    staffId: true,
                  }
                }
              }
            },
            patient: {
              select: {
                firstName: true,
                surname: true,
                patientId: true,
              }
            },
            bed: {
              select: {
                bedNumber: true,
              }
            },
          },
        },
      },
    });

    if (!ward) {
      throw new NotFoundException('Ward not found');
    }
    return ward;
  }

  async updateWard(id: string, dto: UpdateWardDto) {
    await this.findWardById(id);
    return this.prisma.ward.update({
      where: { id },
      data: {
        name: dto.name,
        capacity: dto.capacity,
        type: dto.type,
        departmentId: dto.departmentId ?? null,
      },
    });
  }

  async createBed(dto: CreateBedDto) {
    // Ensure ward exists
    await this.findWardById(dto.wardId);
    return this.prisma.bed.create({
      data: {
        wardId: dto.wardId,
        bedNumber: dto.bedNumber,
        status: dto.status ?? 'AVAILABLE',
      },
    });
  }

  findBedsByWard(wardId: string) {
    return this.prisma.bed.findMany({
      where: { wardId },
      orderBy: { bedNumber: 'asc' },
    });
  }

  async updateBed(id: string, dto: UpdateBedDto) {
    const bed = await this.prisma.bed.findUnique({ where: { id } });
    if (!bed) {
      throw new NotFoundException('Bed not found');
    }

    return this.prisma.bed.update({
      where: { id },
      data: {
        bedNumber: dto.bedNumber,
        status: dto.status,
      },
    });
  }
}
