import { compareMetrics } from './billing-analytics-math';

describe('compareMetrics', () => {
  it('returns flat when both zero', () => {
    expect(compareMetrics(0, 0)).toEqual({
      percentChange: 0,
      direction: 'flat',
    });
  });

  it('returns 100% up when previous is 0 and current > 0', () => {
    expect(compareMetrics(50, 0)).toEqual({
      percentChange: 100,
      direction: 'up',
    });
  });

  it('computes percent and direction when previous > 0', () => {
    expect(compareMetrics(150, 100)).toMatchObject({
      percentChange: 50,
      direction: 'up',
    });
    expect(compareMetrics(80, 100)).toMatchObject({
      percentChange: -20,
      direction: 'down',
    });
    expect(compareMetrics(100, 100)).toMatchObject({
      percentChange: 0,
      direction: 'flat',
    });
  });
});
