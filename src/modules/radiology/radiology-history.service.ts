import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toPatientNameDto } from '../../common/utils/patient-display-name.util';

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

    const orders = await this.prisma.radiologyOrder.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            schedule: {
              include: {
                machine: true,
                radiographer: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            procedure: {
              include: {
                performedBy: {
                  select: { id: true, firstName: true, lastName: true },
                },
                machine: true,
              },
            },
            report: {
              include: {
                signedBy: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            images: { select: { id: true, fileName: true, uploadedAt: true } },
          },
        },
      },
    });

    return {
      patientId,
      patient: {
        id: patient.id,
        patientId: patient.patientId,
        ...toPatientNameDto(patient),
      },
      orders,
    };
  }
}
