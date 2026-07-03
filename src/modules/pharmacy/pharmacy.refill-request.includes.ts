import { Prisma } from '@prisma/client';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';

const doctorNameSelect = {
  firstName: true,
  lastName: true,
} as const;

const drugSelect = {
  id: true,
  brandName: true,
  genericName: true,
  strength: true,
} as const;

export const pharmacyRefillRequestInclude = {
  patient: {
    select: patientNameFieldsSelect,
  },
  prescription: {
    select: {
      id: true,
      drug: true,
      dosage: true,
      startDate: true,
      endDate: true,
      refillsAllowed: true,
      doctor: { select: doctorNameSelect },
      items: {
        where: { itemType: 'DRUG' },
        select: {
          id: true,
          dosage: true,
          frequency: true,
          quantityDispensed: true,
          quantityPrescribed: true,
          instructions: true,
          drugId: true,
          drug: { select: drugSelect },
        },
      },
    },
  },
  invoiceItem: {
    select: {
      id: true,
      invoiceId: true,
      quantity: true,
      settled: true,
      drugId: true,
      invoice: {
        select: { status: true },
      },
    },
  },
} satisfies Prisma.PrescriptionRefillRequestInclude;

export type PharmacyRefillRequestRow = Prisma.PrescriptionRefillRequestGetPayload<{
  include: typeof pharmacyRefillRequestInclude;
}>;
