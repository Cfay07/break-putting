import { describe, expect, it } from 'vitest';
import { compare, practiceWeeks, statusOf, windows } from './progress';

describe('is practice paying off', () => {
  it('waits until there is enough on both sides, and says how much more', () => {
    expect(compare([12], [11, 12])).toMatchObject({ verdict: 'early', need: 2 });
  });

  it('calls a jump bigger than your normal swing better', () => {
    expect(compare([14, 15, 14], [11, 12, 11, 12]).verdict).toBe('better');
  });

  it('calls a change inside your normal swing holding', () => {
    expect(compare([12, 11, 13], [12, 11, 12, 13]).verdict).toBe('holding');
  });

  it('splits by the last four weeks and the eight before', () => {
    const w = windows([{ date: '2026-11-08' }, { date: '2026-10-01' }, { date: '2026-06-01' }], '2026-11-09');
    expect([w.recent.length, w.before.length]).toEqual([1, 1]);
  });

  it('marks the weeks you practiced, newest last', () => {
    expect(practiceWeeks(['2026-11-02', '2026-10-31'], '2026-11-09', 3)).toEqual([true, true, false]);
  });

  it('reads effort against results like a training status', () => {
    expect(statusOf(true, 'better')).toBe('paying');
    expect(statusOf(true, 'holding')).toBe('steady');
    expect(statusOf(true, 'worse')).toBe('not-yet');
    expect(statusOf(false, 'worse')).toBe('slipping');
    expect(statusOf(true, 'early')).toBe('baseline');
  });
});

describe('a new player', () => {
  it('compares the last two against the rest once there are five, however recent', () => {
    const items = ['2026-10-20', '2026-10-25', '2026-11-01', '2026-11-05', '2026-11-08'].map((date) => ({ date }));
    const w = windows(items, '2026-11-09');
    expect([w.recent.length, w.before.length]).toEqual([2, 3]);
  });
});
