import {
  buildPatientNameSearchWhere,
  normalizePatientSearchName,
} from './patient-name-search.util';

describe('normalizePatientSearchName', () => {
  it('joins and lowercases name parts', () => {
    expect(normalizePatientSearchName('John', 'Michael', 'Doe')).toBe(
      'john michael doe',
    );
  });

  it('skips empty parts and collapses spaces', () => {
    expect(normalizePatientSearchName('  John  ', null, '  Doe ')).toBe(
      'john doe',
    );
  });

  it('returns empty string when all parts missing', () => {
    expect(normalizePatientSearchName(null, undefined, '')).toBe('');
  });
});

describe('buildPatientNameSearchWhere', () => {
  it('returns empty object for blank query', () => {
    expect(buildPatientNameSearchWhere('   ')).toEqual({});
  });

  it('single token ORs across name fields and searchName', () => {
    const where = buildPatientNameSearchWhere('John');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { firstName: { contains: 'John', mode: 'insensitive' } },
        { otherName: { contains: 'John', mode: 'insensitive' } },
        { surname: { contains: 'John', mode: 'insensitive' } },
        { searchName: { contains: 'John', mode: 'insensitive' } },
      ]),
    );
    expect(where.OR).toHaveLength(4);
  });

  it('two tokens match searchName and firstName+surname (and reversed)', () => {
    const where = buildPatientNameSearchWhere('John Doe');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { searchName: { contains: 'john doe', mode: 'insensitive' } },
        {
          AND: [
            { firstName: { contains: 'John', mode: 'insensitive' } },
            { surname: { contains: 'Doe', mode: 'insensitive' } },
          ],
        },
        {
          AND: [
            { firstName: { contains: 'Doe', mode: 'insensitive' } },
            { surname: { contains: 'John', mode: 'insensitive' } },
          ],
        },
      ]),
    );
  });

  it('reversed two-token query still includes both orderings', () => {
    const where = buildPatientNameSearchWhere('Doe John');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { searchName: { contains: 'doe john', mode: 'insensitive' } },
        {
          AND: [
            { firstName: { contains: 'Doe', mode: 'insensitive' } },
            { surname: { contains: 'John', mode: 'insensitive' } },
          ],
        },
        {
          AND: [
            { firstName: { contains: 'John', mode: 'insensitive' } },
            { surname: { contains: 'Doe', mode: 'insensitive' } },
          ],
        },
      ]),
    );
  });

  it('three tokens match searchName and first/middle/last fields', () => {
    const where = buildPatientNameSearchWhere('John Michael Doe');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        {
          searchName: { contains: 'john michael doe', mode: 'insensitive' },
        },
        {
          AND: [
            { firstName: { contains: 'John', mode: 'insensitive' } },
            { otherName: { contains: 'Michael', mode: 'insensitive' } },
            { surname: { contains: 'Doe', mode: 'insensitive' } },
          ],
        },
        {
          AND: [
            { firstName: { contains: 'John', mode: 'insensitive' } },
            { surname: { contains: 'Doe', mode: 'insensitive' } },
          ],
        },
      ]),
    );
  });

  it('partial multi-word still uses contains on searchName', () => {
    const where = buildPatientNameSearchWhere('ohn Do');
    expect(where.OR?.[0]).toEqual({
      searchName: { contains: 'ohn do', mode: 'insensitive' },
    });
  });
});
