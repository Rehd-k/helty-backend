import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_DEVICE_KEY = 'allowPendingDevice';

/**
 * Patient routes that remain usable while the current device is PENDING
 * (waiting for frontdesk approval).
 */
export const AllowPendingDevice = () =>
  SetMetadata(ALLOW_PENDING_DEVICE_KEY, true);
