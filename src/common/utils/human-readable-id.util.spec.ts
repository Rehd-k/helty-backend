jest.mock('nanoid', () => ({
  customAlphabet: (alphabet: string) => (size: number) =>
    Array.from({ length: size }, (_, i) => alphabet[i % alphabet.length]).join(
      '',
    ),
}));

import {
  generateHumanReadableId,
  generateSafeNanoid,
  HUMAN_READABLE_ID_ALPHABET,
} from './human-readable-id.util';

const AMBIGUOUS = /[01oOiI]/;

describe('human-readable-id.util', () => {
  it('excludes ambiguous characters from the alphabet', () => {
    expect(HUMAN_READABLE_ID_ALPHABET).not.toMatch(AMBIGUOUS);
  });

  it('generateHumanReadableId only uses the safe alphabet', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateHumanReadableId(10)).toMatch(
        new RegExp(`^[${HUMAN_READABLE_ID_ALPHABET}]{10}$`),
      );
    }
  });

  it('generateSafeNanoid excludes ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSafeNanoid()).not.toMatch(AMBIGUOUS);
    }
  });
});
