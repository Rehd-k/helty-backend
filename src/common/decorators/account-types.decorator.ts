import { SetMetadata } from '@nestjs/common';

export const ACCOUNT_TYPES_KEY = 'accountTypes';

/**
 * Restrict route to staff with one of the given accountType values (e.g. INPATIENT_DOCTOR).
 * Used together with AccessGuard which checks user.accountType when this metadata is set.
 */
export const AccountTypes = (...accountTypes: string[]) =>
  SetMetadata(ACCOUNT_TYPES_KEY, accountTypes);
