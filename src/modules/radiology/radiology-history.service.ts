import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RadiologyHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getPatientRadiologyHistory(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" not found.`);
    }

    const requests = await this.prisma.radiologyRequest.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        schedule: {
          include: {
            machine: true,
            radiographer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        procedure: {
          include: {
            performedBy: { select: { id: true, firstName: true, lastName: true } },
            machine: true,
          },
        },
        report: {
          include: {
            signedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        images: { select: { id: true, fileName: true, uploadedAt: true } },
      },
    });

    return {
      patientId,
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        surname: patient.surname,
        patientId: patient.patientId,
      },
      requests,
    };
  }
}
