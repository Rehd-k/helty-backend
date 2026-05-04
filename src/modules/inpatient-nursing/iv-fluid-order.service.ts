import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
} from './inpatient-nursing.utils';
import { CreateIvFluidOrderDto, UpdateIvFluidOrderDto } from './dto/iv.dto';

@Injectable()
export class IvFluidOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.iVFluidOrder.findMany({
      where: { admissionId },
      orderBy: { startTime: 'desc' },
      include: {
        orderedBy: { select: { id: true, firstName: true, lastName: true } },
        monitorings: {
          orderBy: { recordedAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  async create(
    admissionId: string,
    dto: CreateIvFluidOrderDto,
    orderedByDoctorId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);

    const doctor = await this.prisma.staff.findUnique({
      where: { id: orderedByDoctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Ordering doctor not found.`);
    }

    return this.prisma.iVFluidOrder.create({
      data: {
        admissionId,
        orderedByDoctorId,
        fluidType: dto.fluidType.trim(),
        volume: dto.volume,
        rate: dto.rate,
        startTime: new Date(dto.startTime),
        expectedEndTime: new Date(dto.expectedEndTime),
      },
      include: {
        orderedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(
    admissionId: string,
    orderId: string,
    dto: UpdateIvFluidOrderDto,
  ) {
    const row = await this.prisma.iVFluidOrder.findFirst({
      where: { id: orderId, admissionId },
    });
    if (!row) {
      throw new NotFoundException(
        'IV fluid order not found for this admission.',
      );
    }
    return this.prisma.iVFluidOrder.update({
      where: { id: orderId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.expectedEndTime !== undefined && {
          expectedEndTime: new Date(dto.expectedEndTime),
        }),
      },
      include: {
        orderedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
