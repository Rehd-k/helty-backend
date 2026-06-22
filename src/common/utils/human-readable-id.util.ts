import { customAlphabet } from 'nanoid';

/** Uppercase alphanumeric without 0, 1, O, I (and lowercase o, i). */
export const HUMAN_READABLE_ID_ALPHABET =
  '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const generateUpperHumanId = customAlphabet(HUMAN_READABLE_ID_ALPHABET);

/** Generates a short uppercase ID for patientId, invoiceID, etc. */
export function generateHumanReadableId(size = 8): string {
  return generateUpperHumanId(size);
}

/** URL/file-safe nanoid default alphabet minus visually ambiguous 0, 1, o, i. */
const NANOID_SAFE_ALPHABET =
  '_-23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

const generateSafeNanoidInternal = customAlphabet(NANOID_SAFE_ALPHABET);

/** Drop-in replacement for `nanoid()` without ambiguous characters. */
export function generateSafeNanoid(size = 21): string {
  return generateSafeNanoidInternal(size);
}
