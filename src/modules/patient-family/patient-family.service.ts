import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
} from '../../common/utils/patient-display-name.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';

@Injectable()
export class PatientFamilyService {
  constructor(private readonly prisma: PrismaService) {}

  async listChildren(user: PatientJwtPayload) {
    const links = await this.prisma.patientFamilyLink.findMany({
      where: { parentPatientId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: {
        child: {
          select: patientNameFieldsSelect,
        },
      },
    });

    return {
      data: links.map((link) => ({
        id: link.id,
        linkedAt: link.createdAt,
        child: {
          id: link.child.id,
          patientId: link.child.patientId,
          displayName: formatPatientDisplayName(link.child),
          dob: link.child.dob,
          gender: link.child.gender,
          avatarUrl: link.child.avatarUrl ?? null,
        },
      })),
    };
  }

  /**
   * Resolves which patient UUID portal reads should use.
   * `forPatientId` may be self or a linked child.
   */
  async resolveSubjectPatientId(
    user: PatientJwtPayload,
    forPatientId?: string | null,
  ): Promise<string> {
    const subjectId = forPatientId?.trim() || user.sub;
    if (subjectId === user.sub) {
      return user.sub;
    }

    const link = await this.prisma.patientFamilyLink.findUnique({
      where: {
        parentPatientId_childPatientId: {
          parentPatientId: user.sub,
          childPatientId: subjectId,
        },
      },
      select: { id: true },
    });
    if (!link) {
      throw new ForbiddenException({
        message: 'Not authorized to access this family member',
        code: 'FAMILY_ACCESS_DENIED',
      });
    }
    return subjectId;
  }

  async assertChildExists(childId: string) {
    const child = await this.prisma.patient.findUnique({
      where: { id: childId },
      select: { id: true },
    });
    if (!child) {
      throw new NotFoundException('Patient not found');
    }
  }

  async findParentIds(childPatientId: string): Promise<string[]> {
    const links = await this.prisma.patientFamilyLink.findMany({
      where: { childPatientId },
      select: { parentPatientId: true },
    });
    return links.map((l) => l.parentPatientId);
  }
}
