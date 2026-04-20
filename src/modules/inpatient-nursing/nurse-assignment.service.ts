import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertTargetStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import { CreateNurseAssignmentDto } from './dto/nurse-assignment.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class NurseAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.nurseAssignment.findMany({
      where: { admissionId },
      orderBy: [{ shiftDate: 'desc' }, { shiftType: 'asc' }],
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(admissionId: string, dto: CreateNurseAssignmentDto) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);

    await assertTargetStaffIsNurseOrThrow(this.prisma, dto.nurseId);

    const shiftDate = new Date(dto.shiftDate);
    shiftDate.setUTCHours(0, 0, 0, 0);

    try {
      return await this.prisma.nurseAssignment.create({
        data: {
          admissionId,
          nurseId: dto.nurseId,
          shiftDate,
          shiftType: dto.shiftType,
        },
        include: { nurse: { select: nurseSelect } },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'This nurse is already assigned for this admission, shift date, and shift type.',
        );
      }
      throw e;
    }
  }

  async remove(admissionId: string, assignmentId: string) {
    const row = await this.prisma.nurseAssignment.findFirst({
      where: { id: assignmentId, admissionId },
    });
    if (!row) {
      throw new NotFoundException('Nurse assignment not found.');
    }
    await this.prisma.nurseAssignment.delete({ where: { id: assignmentId } });
  }
}
