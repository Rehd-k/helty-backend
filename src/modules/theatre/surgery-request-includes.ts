import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';

export const surgeryRequestSummaryInclude = {
  patient: { select: patientNameFieldsSelect },
  encounter: { select: { id: true, encounterType: true, startTime: true } },
  admission: {
    select: {
      id: true,
      wardId: true,
      bedId: true,
      status: true,
      wardEntity: { select: { id: true, name: true } },
    },
  },
  requestedBy: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
  service: {
    select: { id: true, name: true, searviceCode: true, cost: true },
  },
  invoiceItem: {
    select: { id: true, invoiceId: true, serviceId: true },
  },
  schedule: {
    include: {
      theatreRoom: { select: { id: true, name: true, isActive: true } },
      surgeon: {
        select: { id: true, firstName: true, lastName: true, staffId: true },
      },
      anaesthetist: {
        select: { id: true, firstName: true, lastName: true, staffId: true },
      },
      scrubNurse: {
        select: { id: true, firstName: true, lastName: true, staffId: true },
      },
    },
  },
  case: {
    include: {
      performedBy: {
        select: { id: true, firstName: true, lastName: true, staffId: true },
      },
      consumables: {
        include: {
          consumable: { select: { id: true, name: true } },
          storeLocation: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      staff: {
        include: {
          staff: {
            select: { id: true, firstName: true, lastName: true, staffId: true },
          },
        },
      },
    },
  },
} as const;

export const theatreCaseConsumableInclude = {
  consumable: { select: { id: true, name: true } },
  storeLocation: { select: { id: true, name: true, code: true } },
} as const;

export const theatreScheduleListInclude = {
  surgeryRequest: {
    include: {
      patient: { select: patientNameFieldsSelect },
      service: { select: { id: true, name: true } },
      requestedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  },
  theatreRoom: { select: { id: true, name: true } },
  surgeon: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
  anaesthetist: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
  scrubNurse: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
} as const;
