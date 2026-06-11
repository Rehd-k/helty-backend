import { BadRequestException } from '@nestjs/common';
import { AccountType, StaffRole } from '@prisma/client';
import {
  isChargeNurseRole,
  isMatronRole,
} from '../nursing/nursing.constants';
import { NURSING_ACCOUNT_TYPE_ROLES } from '../nursing/nursing-scope.utils';

const ACCOUNT_TYPE_ALLOWED_ROLES: Partial<
  Record<AccountType, ReadonlySet<StaffRole>>
> = {
  [AccountType.NURSE]: NURSING_ACCOUNT_TYPE_ROLES,
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

  if (isMatronRole(input.staffRole)) {
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
