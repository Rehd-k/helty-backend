import { normalizePhoneForTermii } from './termii-phone.util';

describe('normalizePhoneForTermii', () => {
  it('converts local Nigerian format to international', () => {
    expect(normalizePhoneForTermii('08030000000')).toBe('2348030000000');
    expect(normalizePhoneForTermii('+234 803 000 0000')).toBe('2348030000000');
  });

  it('returns null for empty or too-short numbers', () => {
    expect(normalizePhoneForTermii('')).toBeNull();
    expect(normalizePhoneForTermii('123')).toBeNull();
  });
});
