import { Prisma } from '@prisma/client';
import {
  AppointmentListFilter,
  APPOINTMENT_LIST_FILTER,
  PortalAppointmentStatus,
  PORTAL_APPOINTMENT_STATUS,
  RAW_CANCELLED_STATUSES,
  RAW_COMPLETED_STATUSES,
  RAW_CONFIRMED_STATUSES,
  RAW_PENDING_STATUSES,
  RAW_REQUESTED_STATUSES,
} from './patient-appointments.constants';

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

export function toPortalStatus(status: string): PortalAppointmentStatus {
  const normalized = normalizeStatus(status);
  if (RAW_REQUESTED_STATUSES.map(normalizeStatus).includes(normalized)) {
    return PORTAL_APPOINTMENT_STATUS.REQUESTED;
  }
  if (RAW_PENDING_STATUSES.map(normalizeStatus).includes(normalized)) {
    return PORTAL_APPOINTMENT_STATUS.PENDING;
  }
  if (RAW_CANCELLED_STATUSES.map(normalizeStatus).includes(normalized)) {
    return PORTAL_APPOINTMENT_STATUS.CANCELLED;
  }
  if (RAW_COMPLETED_STATUSES.map(normalizeStatus).includes(normalized)) {
    return PORTAL_APPOINTMENT_STATUS.COMPLETED;
  }
  if (RAW_CONFIRMED_STATUSES.map(normalizeStatus).includes(normalized)) {
    return PORTAL_APPOINTMENT_STATUS.CONFIRMED;
  }
  return PORTAL_APPOINTMENT_STATUS.CONFIRMED;
}

export function isUpcomingPortalStatus(status: string): boolean {
  const portal = toPortalStatus(status);
  return (
    portal === PORTAL_APPOINTMENT_STATUS.CONFIRMED ||
    portal === PORTAL_APPOINTMENT_STATUS.PENDING ||
    portal === PORTAL_APPOINTMENT_STATUS.REQUESTED
  );
}

export function isPastPortalStatus(status: string): boolean {
  const portal = toPortalStatus(status);
  return (
    portal === PORTAL_APPOINTMENT_STATUS.COMPLETED ||
    portal === PORTAL_APPOINTMENT_STATUS.CANCELLED
  );
}

export function rawStatusesForPortal(
  portal: PortalAppointmentStatus,
): readonly string[] {
  switch (portal) {
    case PORTAL_APPOINTMENT_STATUS.REQUESTED:
      return RAW_REQUESTED_STATUSES;
    case PORTAL_APPOINTMENT_STATUS.CONFIRMED:
      return RAW_CONFIRMED_STATUSES;
    case PORTAL_APPOINTMENT_STATUS.PENDING:
      return RAW_PENDING_STATUSES;
    case PORTAL_APPOINTMENT_STATUS.CANCELLED:
      return RAW_CANCELLED_STATUSES;
    case PORTAL_APPOINTMENT_STATUS.COMPLETED:
      return RAW_COMPLETED_STATUSES;
    default:
      return [];
  }
}

export function buildAppointmentFilterWhere(
  patientId: string,
  filter: AppointmentListFilter,
  now: Date,
): Prisma.AppointmentWhereInput {
  const base = { patientId };

  switch (filter) {
    case APPOINTMENT_LIST_FILTER.UPCOMING:
      return {
        ...base,
        date: { gte: now },
        status: {
          in: [
            ...RAW_CONFIRMED_STATUSES,
            ...RAW_PENDING_STATUSES,
            ...RAW_REQUESTED_STATUSES,
          ],
        },
      };
    case APPOINTMENT_LIST_FILTER.PAST:
      return {
        ...base,
        status: {
          in: [...RAW_COMPLETED_STATUSES, ...RAW_CANCELLED_STATUSES],
        },
      };
    case APPOINTMENT_LIST_FILTER.PENDING:
      return {
        ...base,
        status: {
          in: [...RAW_PENDING_STATUSES, ...RAW_REQUESTED_STATUSES],
        },
      };
    default:
      return base;
  }
}

export function sortOrderForFilter(
  filter: AppointmentListFilter,
): Prisma.AppointmentOrderByWithRelationInput {
  if (filter === APPOINTMENT_LIST_FILTER.PAST) {
    return { date: 'desc' };
  }
  return { date: 'asc' };
}
