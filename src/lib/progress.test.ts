import { describe, expect, it } from 'vitest';
import { compare, practiceSplit, practiceWeeks, statusOf, windows } from './progress';

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

describe('practice and the course', () => {
  const round = (date: string): import('./types').Round =>
    ({ id: date, date, putterId: 'p', holeCount: 9, finished: true, holes: [{ hole: 1, par: 4, strokes: 4, putts: [{ d: 10, made: true }] }] }) as never;
  const base: [number, number][] = [[1, 1], [10, 1.6], [40, 2]];

  it('splits on any practice when there are rounds with none', () => {
    const rounds = ['2026-10-01', '2026-10-05', '2026-10-09', '2026-10-20'].map(round);
    const s = practiceSplit(rounds, [{ date: '2026-10-19', balls: 30 }], base);
    expect([s.mode, s.after.length, s.without.length]).toEqual(['any', 1, 3]);
  });

  it('compares more practice with less for someone who practices most weeks', () => {
    const dates = ['2026-10-02', '2026-10-06', '2026-10-10', '2026-10-14', '2026-10-18', '2026-10-22'];
    const practice = dates.map((d, i) => ({ date: `2026-10-${String(Number(d.slice(-2)) - 1).padStart(2, '0')}`, balls: (i + 1) * 10 }));
    const s = practiceSplit(dates.map(round), practice, base);
    expect(s.mode).toBe('amount');
    expect(s.after.length + s.without.length).toBe(6);
  });
});
