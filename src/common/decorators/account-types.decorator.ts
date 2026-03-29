import { SetMetadata } from '@nestjs/common';

export const ACCOUNT_TYPES_KEY = 'accountTypes';

/**
 * Restrict route to staff matching one of the given tokens: new `AccountType` / `StaffRole`
 * values, or legacy flat tokens (e.g. INPATIENT_DOCTOR, RADIOLOGY) resolved in AccessGuard.
 */
export const AccountTypes = (...accountTypes: string[]) =>
  SetMetadata(ACCOUNT_TYPES_KEY, accountTypes);
