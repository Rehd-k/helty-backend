import {
  addDays,
  averageCycleLengthDays,
  buildCycleStatus,
  canAutoCloseOpenPeriod,
  findOverlappingPeriod,
  monthRange,
  parseDateKey,
  predictedPeriodDays,
  toDateKey,
} from './patient-cycle.util';

describe('patient-cycle.util', () => {
  const d = (key: string) => parseDateKey(key);

  it('parses and formats UTC calendar keys', () => {
    expect(toDateKey(d('2026-09-13'))).toBe('2026-09-13');
    expect(() => parseDateKey('2026-13-01')).toThrow();
    expect(() => parseDateKey('2026-09-31')).toThrow();
  });

  it('builds inclusive month ranges', () => {
    const { start, end } = monthRange(2026, 9);
    expect(toDateKey(start)).toBe('2026-09-01');
    expect(toDateKey(end)).toBe('2026-09-30');
  });

  it('averages the last six cycle gaps and clamps 21-45', () => {
    expect(averageCycleLengthDays([d('2026-01-01')], 28)).toBe(28);
    expect(
      averageCycleLengthDays([
        d('2026-01-01'),
        d('2026-01-29'),
        d('2026-02-26'),
      ]),
    ).toBe(28);
    expect(
      averageCycleLengthDays([d('2026-01-01'), d('2026-03-01')], 28),
    ).toBe(45);
    expect(
      averageCycleLengthDays([d('2026-01-01'), d('2026-01-10')], 28),
    ).toBe(21);
  });

  it('detects overlapping ranges including open periods', () => {
    const existing = [
      { id: 'a', startDate: d('2026-09-01'), endDate: d('2026-09-05') },
      { id: 'open', startDate: d('2026-09-20'), endDate: null },
    ];
    expect(
      findOverlappingPeriod(
        { start: d('2026-09-04'), end: d('2026-09-04') },
        existing,
      ),
    ).toBe(existing[0]);
    expect(
      findOverlappingPeriod(
        { start: d('2026-09-22'), end: d('2026-09-22') },
        existing,
      ),
    ).toBe(existing[1]);
    expect(
      findOverlappingPeriod(
        { start: d('2026-09-10'), end: d('2026-09-12') },
        existing,
      ),
    ).toBeUndefined();
    expect(
      findOverlappingPeriod(
        { start: d('2026-09-04'), end: d('2026-09-04') },
        existing,
        { ignoreId: 'a' },
      ),
    ).toBeUndefined();
  });

  it('auto-closes an open period the day before a later start', () => {
    expect(canAutoCloseOpenPeriod(d('2026-09-01'), d('2026-09-08'))).toBe(
      true,
    );
    expect(canAutoCloseOpenPeriod(d('2026-09-08'), d('2026-09-01'))).toBe(
      false,
    );
  });

  it('projects predicted period days without covering logged days', () => {
    const days = predictedPeriodDays({
      lastStart: d('2026-08-01'),
      cycleLengthDays: 28,
      periodLengthDays: 5,
      rangeStart: d('2026-08-01'),
      rangeEnd: d('2026-09-30'),
      loggedRanges: [
        { start: d('2026-08-01'), end: d('2026-08-05') },
      ],
    });
    expect(days).toContain('2026-08-29');
    expect(days).toContain('2026-09-02');
    expect(days).not.toContain('2026-08-01');
    expect(days).not.toContain('2026-08-05');
  });

  it('builds period-day, expected, and pregnancy-paused headlines', () => {
    const inPeriod = buildCycleStatus({
      today: d('2026-09-03'),
      periods: [{ startDate: d('2026-09-01'), endDate: d('2026-09-05') }],
      cycleLengthDays: 28,
      periodLengthDays: 5,
      pregnancyPaused: false,
    });
    expect(inPeriod.headline).toBe('Period day 3');
    expect(inPeriod.cycleDay).toBe(3);

    const expected = buildCycleStatus({
      today: d('2026-09-20'),
      periods: [{ startDate: d('2026-09-01'), endDate: d('2026-09-05') }],
      cycleLengthDays: 28,
      periodLengthDays: 5,
      pregnancyPaused: false,
    });
    expect(expected.headline).toBe('Expected in 9 days');
    expect(expected.nextPeriodStart).toBe('2026-09-29');

    const paused = buildCycleStatus({
      today: d('2026-09-20'),
      periods: [{ startDate: d('2026-09-01'), endDate: d('2026-09-05') }],
      cycleLengthDays: 28,
      periodLengthDays: 5,
      pregnancyPaused: true,
    });
    expect(paused.headline).toBe('Tracking paused during pregnancy');
    expect(paused.nextPeriodStart).toBeNull();
  });

  it('adds calendar days across month boundaries', () => {
    expect(toDateKey(addDays(d('2026-09-30'), 1))).toBe('2026-10-01');
  });
});
