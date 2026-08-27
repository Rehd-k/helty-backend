import {
  composeOperativeNoteSummary,
  extractSectionNarrative,
} from './operative-note.util';

describe('operative-note.util', () => {
  it('extracts a section narrative from answersJson', () => {
    const text = extractSectionNarrative(
      {
        findings: {
          intraop: 'inflamed appendix',
          unexpected: false,
          other: 'No perforation',
        },
      },
      'findings',
    );
    expect(text).toContain('intraop: inflamed appendix');
    expect(text).toContain('unexpected: No');
    expect(text).toContain('No perforation');
  });

  it('composes case summary fields from the latest note', () => {
    const summary = composeOperativeNoteSummary({
      narrative: 'Procedure: Appendectomy. Findings: inflamed appendix',
      additionalNotes: 'Recovered well',
      answersJson: {
        findings: { intraop: 'inflamed appendix' },
        complications: { occurred: false },
      },
    });
    expect(summary.operativeNotes).toContain('Recovered well');
    expect(summary.findings).toContain('inflamed appendix');
    expect(summary.complications).toContain('occurred: No');
  });
});
