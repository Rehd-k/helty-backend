import { SetMetadata } from '@nestjs/common';

export const REQUIRE_APPROVED_DEVICE_KEY = 'requireApprovedDevice';

/**
 * Explicitly require an APPROVED patient device. Prefer relying on the
 * global ApprovedDeviceGuard default for PATIENT routes; use this when
 * a controller mixes public/staff endpoints.
 */
export const RequireApprovedDevice = () =>
  SetMetadata(REQUIRE_APPROVED_DEVICE_KEY, true);
