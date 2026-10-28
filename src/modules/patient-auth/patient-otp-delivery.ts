export type OtpChannel = 'staff' | 'sms' | 'whatsapp';

export type OtpDeliveryMode = 'staff' | 'phone' | 'both';

const KNOWN: ReadonlySet<string> = new Set(['staff', 'sms', 'whatsapp']);

/** Comma list from PATIENT_OTP_DELIVERY. Empty or unknown values fall back to staff. */
export function parseOtpDelivery(raw: string | undefined | null): Set<OtpChannel> {
  const channels = new Set<OtpChannel>();
  for (const part of (raw ?? '').split(',')) {
    const token = part.trim().toLowerCase();
    if (KNOWN.has(token)) channels.add(token as OtpChannel);
  }
  if (channels.size === 0) channels.add('staff');
  return channels;
}

export function deliveryMode(channels: Set<OtpChannel>): OtpDeliveryMode {
  const staff = channels.has('staff');
  const phone = channels.has('sms') || channels.has('whatsapp');
  if (staff && phone) return 'both';
  if (phone) return 'phone';
  return 'staff';
}
