/**
 * Normalizes a phone number to Termii international format (e.g. 2349012672711).
 * Strips non-digits; converts leading 0 to Nigeria country code 234.
 */
export function normalizePhoneForTermii(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = `234${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith('7')) {
    digits = `234${digits}`;
  } else if (digits.length === 11 && digits.startsWith('234')) {
    // already international
  } else if (!digits.startsWith('234') && digits.length >= 10 && digits.length <= 11) {
    digits = digits.startsWith('234') ? digits : `234${digits}`;
  }

  if (digits.length < 12) return null;
  return digits;
}
