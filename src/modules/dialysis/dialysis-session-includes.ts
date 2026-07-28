import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

export const dialysisSessionSummaryInclude = {
  patient: {
    select: patientNameFieldsSelect,
  },
  doctor: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
  performedBy: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
  service: {
    select: { id: true, name: true },
  },
  invoiceItem: {
    select: { id: true, invoiceId: true, serviceId: true },
  },
} as const;

export const dialysisSessionConsumableInclude = {
  consumable: { select: { id: true, name: true } },
  storeLocation: { select: { id: true, name: true, code: true } },
  createdBy: { select: staffBriefSelect },
} as const;
