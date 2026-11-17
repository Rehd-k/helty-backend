import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Master switch for email, WhatsApp, and SMS. Unset means sending stays on. */
export const OUTBOUND_MESSAGING_ENV = 'OUTBOUND_MESSAGING_ENABLED';

const DISABLED = new Set(['false', '0', 'off', 'no']);

/**
 * Sending stays on unless the value is an explicit off (`false`, `0`, `off`, `no`).
 * Blank or missing keeps the individual provider checks in charge.
 */
export function isOutboundMessagingEnabled(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return true;
  return !DISABLED.has(normalized);
}

/** Returns true when this send must be skipped because the master switch is off. */
export function outboundMessagingIsOff(
  config: ConfigService,
  logger: Logger,
  channel: string,
): boolean {
  if (isOutboundMessagingEnabled(config.get(OUTBOUND_MESSAGING_ENV))) {
    return false;
  }
  logger.warn(
    `Outbound messaging is off (${OUTBOUND_MESSAGING_ENV}); skipping ${channel}.`,
  );
  return true;
}
