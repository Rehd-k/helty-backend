import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WardRoundsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns distinct admissions where attendingDoctorId == doctorId (and status active),
   * with latest ward round note summary for the given date (default today).
   */
  async getToday(doctorId: string, dateStr?: string) {
    const doctor = await this.prisma.staff.findUnique({
      where: { id: doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Staff/doctor "${doctorId}" not found.`);
    }

    const date = dateStr ? new Date(dateStr) : new Date();
    date.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const admissions = await this.prisma.admission.findMany({
      where: {
        attendingDoctorId: doctorId,
        status: 'ACTIVE',
      },
      include: {
        patient: true,
        wardEntity: true,
        bed: true,
        wardRoundNotes: {
          where: {
            roundDate: { gte: date, lt: nextDay },
          },
          orderBy: { roundDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { admissionDateTime: 'desc' },
    });

    return admissions.map((admission) => {
      const latestNote = admission.wardRoundNotes[0] ?? null;
      return {
        admission: {
          id: admission.id,
          patientId: admission.patientId,
          ward: admission.wardEntity?.name ?? admission.ward ?? null,
          bedPreference: admission.bed?.bedNumber ?? admission.room ?? null,
          provisionalDiagnosis: admission.primaryDiagnosis ?? null,
          attendingDoctorId: admission.attendingDoctorId,
          status: admission.status,
          admissionDateTime: admission.admissionDateTime,
          patient: admission.patient
            ? {
                id: admission.patient.id,
                firstName: admission.patient.firstName,
                surname: admission.patient.surname,
                patientId: admission.patient.patientId,
              }
            : undefined,
        },
        latestNote: latestNote
          ? {
              id: latestNote.id,
              roundDate: latestNote.roundDate.toISOString().slice(0, 10),
              assessment: latestNote.assessment,
              plan: latestNote.plan,
            }
          : null,
      };
    });
  }
}
