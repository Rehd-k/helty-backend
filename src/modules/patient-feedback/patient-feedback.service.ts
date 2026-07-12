import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PatientFeedbackStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  CreatePatientFeedbackDto,
  ListPatientFeedbackQueryDto,
  UpdatePatientFeedbackDto,
} from './dto/patient-feedback.dto';

const PATIENT_FEEDBACK_INCLUDE = {
  department: { select: { id: true, name: true } },
  respondedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.PatientFeedbackInclude;

@Injectable()
export class PatientFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: PatientJwtPayload, dto: CreatePatientFeedbackDto) {
    return this.prisma.patientFeedback.create({
      data: {
        patientId: user.sub,
        kind: dto.kind,
        subject: dto.subject,
        message: dto.message,
        departmentId: dto.departmentId,
      },
      include: PATIENT_FEEDBACK_INCLUDE,
    });
  }

  async list(user: PatientJwtPayload, query: ListPatientFeedbackQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.PatientFeedbackWhereInput = {
      patientId: user.sub,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.patientFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: PATIENT_FEEDBACK_INCLUDE,
      }),
      this.prisma.patientFeedback.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async get(user: PatientJwtPayload, id: string) {
    return this.findOwned(user.sub, id);
  }

  async update(
    user: PatientJwtPayload,
    id: string,
    dto: UpdatePatientFeedbackDto,
  ) {
    const feedback = await this.findOwned(user.sub, id);
    this.assertPatientEditable(feedback.status);

    return this.prisma.patientFeedback.update({
      where: { id },
      data: {
        kind: dto.kind,
        subject: dto.subject,
        message: dto.message,
        departmentId: dto.departmentId,
      },
      include: PATIENT_FEEDBACK_INCLUDE,
    });
  }

  async remove(user: PatientJwtPayload, id: string) {
    const feedback = await this.findOwned(user.sub, id);
    this.assertPatientEditable(feedback.status);

    const updated = await this.prisma.patientFeedback.update({
      where: { id },
      data: { status: PatientFeedbackStatus.CLOSED },
      include: PATIENT_FEEDBACK_INCLUDE,
    });

    return {
      id: updated.id,
      status: updated.status,
      message: 'Feedback closed.',
    };
  }

  private async findOwned(patientId: string, id: string) {
    const feedback = await this.prisma.patientFeedback.findFirst({
      where: { id, patientId },
      include: PATIENT_FEEDBACK_INCLUDE,
    });
    if (!feedback) {
      throw new NotFoundException(`Feedback "${id}" not found.`);
    }
    return feedback;
  }

  private assertPatientEditable(status: PatientFeedbackStatus) {
    if (status !== PatientFeedbackStatus.OPEN) {
      throw new ConflictException(
        'Feedback can only be changed while it is open.',
      );
    }
  }
}
