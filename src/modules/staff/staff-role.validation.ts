import { BadRequestException } from '@nestjs/common';
import { AccountType, StaffRole } from '@prisma/client';
import {
  isChargeNurseRole,
  isMatronRole,
} from '../nursing/nursing.constants';
import { NURSING_ACCOUNT_TYPE_ROLES } from '../nursing/nursing-scope.utils';

const THEATRE_ACCOUNT_TYPE_ROLES = new Set<StaffRole>([
  StaffRole.THEATRE_HEAD,
  StaffRole.THEATRE_NURSE,
  StaffRole.THEATRE_SCRUB,
  StaffRole.THEATRE_ANAESTHETIST,
  StaffRole.THEATRE_RECEPTIONIST,
]);

const ACCOUNT_TYPE_ALLOWED_ROLES: Record<AccountType, ReadonlySet<StaffRole>> =
  {
    [AccountType.BILLING]: new Set([
      StaffRole.BILLING_HEAD,
      StaffRole.BILLING_STAFF,
    ]),
    [AccountType.ACCOUNTING]: new Set([
      StaffRole.ACCOUNT_HEAD,
      StaffRole.ACCOUNTING_STAFF,
    ]),
    [AccountType.PHARMACY]: new Set([
      StaffRole.PHARMACY_STORE,
      StaffRole.PHARMACY_DISPENSARY,
      StaffRole.PHARMACY_HEAD,
    ]),
    [AccountType.NURSE]: NURSING_ACCOUNT_TYPE_ROLES,
    [AccountType.PHYSICIAN]: new Set([
      StaffRole.PHYSICIAN_HEAD,
      StaffRole.CONSULTANT,
      StaffRole.SPECIALIST,
      StaffRole.RESIDENT,
      StaffRole.INTERN,
      StaffRole.JUNIOR_RESIDENT,
      StaffRole.SENIOR_RESIDENT,
      StaffRole.CHIEF_RESIDENT,
      StaffRole.HOUSE_OFFICER,
      StaffRole.MEDICAL_OFFICER,
      StaffRole.MEDICAL_STUDENT,
    ]),
    [AccountType.LABORATORY]: new Set([
      StaffRole.LAB_HEAD,
      StaffRole.LAB_SCIENTIST,
    ]),
    [AccountType.RADIOLOGY]: new Set([
      StaffRole.RADIOLOGY_HEAD,
      StaffRole.RADIOGRAPHER,
      StaffRole.RADIOLOGY_RECEPTIONIST,
    ]),
    [AccountType.STORE]: new Set([
      StaffRole.HEAD_OF_STORE,
      StaffRole.STOREKEEPER,
    ]),
    [AccountType.MEDICAL_RECORDS]: new Set([
      StaffRole.MEDICAL_RECORDS_HEAD,
      StaffRole.MEDICAL_RECORDS,
    ]),
    [AccountType.FRONT_DESK]: new Set([
      StaffRole.FRONT_DESK_HEAD,
      StaffRole.FRONT_DESK,
    ]),
    [AccountType.ICT]: new Set([StaffRole.ICT_HEAD, StaffRole.ICT_STAFF]),
    [AccountType.CMD]: new Set([StaffRole.CMD]),
    [AccountType.CMAC]: new Set([StaffRole.CMAC]),
    [AccountType.HMO]: new Set([StaffRole.HMO_HEAD, StaffRole.HMO_STAFF]),
    [AccountType.PURCHASES]: new Set([
      StaffRole.PURCHASES_STORE,
      StaffRole.PURCHASES_STAFF,
      StaffRole.PURCHASES_HEAD,
    ]),
    [AccountType.DIALYSIS]: new Set([
      StaffRole.DIALYSIS_HEAD,
      StaffRole.DIALYSIS_NURSE,
      StaffRole.DIALYSIS_TECH,
      StaffRole.DIALYSIS_RECEPTIONIST,
    ]),
    [AccountType.THEATRE]: THEATRE_ACCOUNT_TYPE_ROLES,
    [AccountType.JANITOR]: new Set([StaffRole.JANITOR_HEAD]),
    [AccountType.SUPER_ADMIN]: new Set([StaffRole.SUPER_ADMIN]),
  };

export function validateStaffRolePairing(input: {
  accountType: AccountType;
  staffRole: StaffRole;
  departmentId?: string | null;
  wardId?: string | null;
}): void {
  const allowed = ACCOUNT_TYPE_ALLOWED_ROLES[input.accountType];
  if (allowed && !allowed.has(input.staffRole)) {
    throw new BadRequestException(
      `staffRole ${input.staffRole} is not valid for accountType ${input.accountType}.`,
    );
  }

  if (isChargeNurseRole(input.staffRole)) {
    if (!input.wardId) {
      throw new BadRequestException(
        `Charge nurse role ${input.staffRole} requires wardId.`,
      );
    }
    if (input.departmentId) {
      throw new BadRequestException(
        'Charge nurse roles must use wardId, not departmentId.',
      );
    }
  }

  if (isMatronRole(input.staffRole) && input.staffRole === StaffRole.MATRON) {
    if (input.departmentId) {
      throw new BadRequestException(
        'Matron must not be assigned to a single department.',
      );
    }
    if (input.wardId) {
      throw new BadRequestException(
        'Matron must not be assigned to a single ward.',
      );
    }
  }
}

export { ACCOUNT_TYPE_ALLOWED_ROLES };
