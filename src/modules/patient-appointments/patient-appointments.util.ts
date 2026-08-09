import {
  AppointmentVisitType,
  EncounterStatus,
  LabRequestStatus,
  MedicalSpecialty,
} from '@prisma/client';
import { getCatalogEntry } from '../clinical-specialty/clinical-specialty-catalog';
import {
  ConsultationResultStatus,
  CONSULTATION_RESULT_STATUS,
} from './patient-appointments.constants';
import {
  canCancelAppointment,
  canRescheduleAppointment,
} from './patient-appointments.policy';
import { toPortalStatus } from './patient-appointments.status';
import {
  AppointmentDetailDto,
  AppointmentSummaryDto,
  BookingDoctorDto,
  ConsultationHistoryItemDto,
} from './dto/appointment-response.dto';

type DoctorFields = {
  id: string;
  firstName: string;
  lastName: string;
  medicalSpecialty: MedicalSpecialty | null;
  department: { name: string } | null;
};

type AppointmentRow = {
  id: string;
  date: Date;
  status: string;
  location: string | null;
  specialty?: string | null;
  visitType?: AppointmentVisitType | null;
  reason?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  staff: DoctorFields | null;
};

type ConsultationHistoryRow = {
  id: string;
  startTime: Date;
  status: EncounterStatus;
  chiefComplaint: string | null;
  visitType: string | null;
  primaryIcdDescription: string | null;
  doctor: {
    firstName: string;
    lastName: string;
    department: { name: string } | null;
  };
  diagnoses: Array<{ primaryIcdDescription: string | null }>;
  labRequests: Array<{ status: LabRequestStatus }>;
  labReports: Array<{ results: string }>;
};

export function formatDoctorDisplayName(
  doctor: Pick<DoctorFields, 'firstName' | 'lastName'>,
): string {
  const parts = [doctor.firstName, doctor.lastName].filter(Boolean);
  if (!parts.length) {
    return 'Unknown doctor';
  }
  return `Dr. ${parts.join(' ')}`;
}

function resolveDoctorSpecialty(doctor: DoctorFields | null): string | null {
  if (!doctor) {
    return null;
  }
  if (doctor.medicalSpecialty) {
    return getCatalogEntry(doctor.medicalSpecialty)?.displayName ?? null;
  }
  return doctor.department?.name ?? null;
}

function resolveAppointmentSpecialty(
  specialty: string | null | undefined,
  doctor: DoctorFields | null,
): string | null {
  if (specialty) {
    const catalog = getCatalogEntry(specialty as MedicalSpecialty);
    return catalog?.displayName ?? specialty;
  }
  return resolveDoctorSpecialty(doctor);
}

function toDoctorDto(
  doctor: DoctorFields | null,
  specialtyFallback: string | null,
): AppointmentSummaryDto['doctor'] {
  if (!doctor) {
    return {
      id: '',
      name: 'Unassigned',
      specialty: specialtyFallback,
      avatarUrl: null,
    };
  }
  return {
    id: doctor.id,
    name: formatDoctorDisplayName(doctor),
    specialty: resolveDoctorSpecialty(doctor) ?? specialtyFallback,
    avatarUrl: null,
  };
}

export function toAppointmentSummaryDto(
  appointment: AppointmentRow,
  now: Date = new Date(),
): AppointmentSummaryDto {
  const specialty = resolveAppointmentSpecialty(
    appointment.specialty,
    appointment.staff,
  );
  return {
    id: appointment.id,
    status: toPortalStatus(appointment.status),
    scheduledAt: appointment.date,
    location: appointment.location,
    specialty: appointment.specialty ?? null,
    visitType: appointment.visitType ?? AppointmentVisitType.IN_PERSON,
    doctor: toDoctorDto(appointment.staff, specialty),
    canReschedule: canRescheduleAppointment(
      appointment.status,
      appointment.date,
      now,
    ),
    canCancel: canCancelAppointment(appointment.status, appointment.date, now),
  };
}

export function toAppointmentDetailDto(
  appointment: AppointmentRow & { createdAt: Date; updatedAt: Date },
  now: Date = new Date(),
): AppointmentDetailDto {
  return {
    ...toAppointmentSummaryDto(appointment, now),
    reason: appointment.reason ?? null,
    notes: appointment.notes ?? null,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

export function toBookingDoctorDto(
  doctor: DoctorFields,
  specialtyId: MedicalSpecialty,
): BookingDoctorDto {
  const catalog = getCatalogEntry(specialtyId);
  return {
    id: doctor.id,
    name: formatDoctorDisplayName(doctor),
    specialty: catalog?.displayName ?? resolveDoctorSpecialty(doctor),
    avatarUrl: null,
  };
}

function resolveEncounterTitle(encounter: ConsultationHistoryRow): string {
  if (encounter.chiefComplaint) {
    return encounter.chiefComplaint;
  }
  const diagnosis =
    encounter.primaryIcdDescription ??
    encounter.diagnoses.find((d) => d.primaryIcdDescription)
      ?.primaryIcdDescription;
  if (diagnosis) {
    return diagnosis;
  }
  if (encounter.visitType) {
    return encounter.visitType;
  }
  return 'Consultation';
}

function resolveResultStatus(
  encounter: ConsultationHistoryRow,
): ConsultationResultStatus {
  if (encounter.status !== EncounterStatus.COMPLETED) {
    return CONSULTATION_RESULT_STATUS.PENDING;
  }

  const hasPendingLabs = encounter.labRequests.some(
    (request) =>
      request.status === LabRequestStatus.REQUESTED ||
      request.status === LabRequestStatus.COLLECTED,
  );
  if (hasPendingLabs) {
    return CONSULTATION_RESULT_STATUS.PENDING;
  }

  const hasAbnormal = encounter.labReports.some((report) =>
    /abnormal/i.test(report.results),
  );
  if (hasAbnormal) {
    return CONSULTATION_RESULT_STATUS.ABNORMAL;
  }

  const hasCompletedLabs = encounter.labRequests.some(
    (request) => request.status === LabRequestStatus.COMPLETED,
  );
  if (hasCompletedLabs) {
    return CONSULTATION_RESULT_STATUS.COMPLETED;
  }

  return CONSULTATION_RESULT_STATUS.NORMAL;
}

export function toConsultationHistoryDto(
  encounter: ConsultationHistoryRow,
): ConsultationHistoryItemDto {
  return {
    id: encounter.id,
    title: resolveEncounterTitle(encounter),
    providerName: formatDoctorDisplayName(encounter.doctor),
    department: encounter.doctor.department?.name ?? null,
    visitedAt: encounter.startTime,
    resultStatus: resolveResultStatus(encounter),
  };
}
