import { Prisma } from '@prisma/client';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';

const staffNameSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffId: true,
} as const;

export const medicationOrderAttributionSelect = {
  id: true,
  drugId: true,
  drugName: true,
  prescribedDrugId: true,
  prescribedDrugName: true,
  dose: true,
  quantity: true,
  frequency: true,
  duration: true,
  route: true,
  status: true,
  specialInstructions: true,
  substitutedAt: true,
  doctorId: true,
  doctor: { select: staffNameSelect },
  prescribedDrug: {
    select: { id: true, genericName: true, brandName: true },
  },
  substitutedByPharmacist: { select: staffNameSelect },
  drug: {
    select: { id: true, genericName: true, brandName: true },
  },
} satisfies Prisma.MedicationOrderSelect;

export const medicationRequestWithDetailsInclude = {
  encounter: {
    select: { id: true, encounterType: true, status: true },
  },
  patient: {
    select: patientNameFieldsSelect,
  },
  ward: { select: { id: true, name: true } },
  requestedByNurse: { select: staffNameSelect },
  billedBy: { select: staffNameSelect },
  medicationOrder: {
    select: medicationOrderAttributionSelect,
  },
  invoiceItem: {
    select: {
      id: true,
      invoiceId: true,
      quantity: true,
      unitPrice: true,
      settled: true,
      amountPaid: true,
      drug: { select: { id: true, genericName: true } },
      invoice: {
        select: {
          id: true,
          invoiceID: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
        },
      },
      _count: { select: { allocations: true } },
    },
  },
} satisfies Prisma.MedicationRequestInclude;
