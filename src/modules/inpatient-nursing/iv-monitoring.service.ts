import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import { CreateIvMonitoringDto } from './dto/iv.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class IvMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string, orderId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    const order = await this.prisma.iVFluidOrder.findFirst({
      where: { id: orderId, admissionId },
    });
    if (!order) {
      throw new NotFoundException(
        'IV fluid order not found for this admission.',
      );
    }
    return this.prisma.iVMonitoring.findMany({
      where: { ivOrderId: orderId, admissionId },
      orderBy: { recordedAt: 'desc' },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(
    admissionId: string,
    orderId: string,
    dto: CreateIvMonitoringDto,
    staffId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);

    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    const order = await this.prisma.iVFluidOrder.findFirst({
      where: { id: orderId, admissionId },
    });
    if (!order) {
      throw new BadRequestException(
        'IV fluid order does not belong to this admission.',
      );
    }

    return this.prisma.iVMonitoring.create({
      data: {
        admissionId,
        ivOrderId: orderId,
        nurseId: staffId,
        currentRate: dto.currentRate,
        insertionSiteCondition: dto.insertionSiteCondition.trim(),
        complications: dto.complications?.trim() || null,
        stoppedAt: dto.stoppedAt ? new Date(dto.stoppedAt) : null,
        reasonStopped: dto.reasonStopped?.trim() || null,
      },
      include: { nurse: { select: nurseSelect } },
    });
  }
}
