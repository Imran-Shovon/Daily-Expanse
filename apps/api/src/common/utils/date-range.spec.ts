import { DateRangeError, pickGranularity, resolveDateRange } from './date-range';

describe('resolveDateRange', () => {
  const today = '2026-10-13'; // Tuesday

  it.each([
    ['today', { from: '2026-10-13', to: '2026-10-13' }],
    ['this_week', { from: '2026-10-12', to: '2026-10-18' }],
    ['this_month', { from: '2026-10-01', to: '2026-10-31' }],
    ['last_month', { from: '2026-09-01', to: '2026-09-30' }],
    ['this_year', { from: '2026-01-01', to: '2026-12-31' }],
  ] as const)('resolves %s', (preset, expected) => {
    expect(resolveDateRange(preset, today)).toEqual(expected);
  });

  it('handles last month across a year boundary', () => {
    expect(resolveDateRange('last_month', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('accepts a valid custom range including a single day', () => {
    expect(resolveDateRange('custom', today, { from: '2026-10-05', to: '2026-10-05' })).toEqual({
      from: '2026-10-05',
      to: '2026-10-05',
    });
  });

  it('rejects invalid custom ranges', () => {
    expect(() => resolveDateRange('custom', today, {})).toThrow(DateRangeError);
    expect(() =>
      resolveDateRange('custom', today, { from: '2026-10-10', to: '2026-10-01' }),
    ).toThrow(DateRangeError);
    expect(() =>
      resolveDateRange('custom', today, { from: '2026-02-30', to: '2026-03-01' }),
    ).toThrow(DateRangeError);
    expect(() =>
      resolveDateRange('custom', today, { from: '1990-01-01', to: '2026-01-01' }),
    ).toThrow(/limited/);
  });
});

describe('pickGranularity', () => {
  it('chooses granularity by range length', () => {
    expect(pickGranularity({ from: '2026-10-01', to: '2026-10-31' })).toBe('day');
    expect(pickGranularity({ from: '2026-08-01', to: '2026-10-31' })).toBe('week');
    expect(pickGranularity({ from: '2026-01-01', to: '2026-12-31' })).toBe('month');
    expect(pickGranularity({ from: '2016-01-01', to: '2026-12-31' })).toBe('year');
  });
});
