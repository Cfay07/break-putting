import { describe, expect, it } from 'vitest';
import { headlineRanks, rankedBy, rankText, roundRanks } from './roundRanks';
import { ninesOf } from './stats';
import { DEFAULT_BASELINE, type Putt, type Round } from './types';

const B = DEFAULT_BASELINE;

/** An 18-hole round: `ones` one-putt holes from 6 ft, the rest two-putts from 20 ft. */
function round(id: string, date: string, ones: number, threes = 0): Round {
  const holes = Array.from({ length: 18 }, (_, i) => {
    const putts: Putt[] =
      i < ones
        ? [{ d: 6, made: true } as Putt]
        : i < ones + threes
          ? [
              { d: 30, made: false },
              { d: 6, made: false },
              { d: 1, made: true },
            ].map((p) => p as Putt)
          : [{ d: 20, made: false } as Putt, { d: 2, made: true } as Putt];
    return { hole: i + 1, par: 4, putts };
  });
  return { id, label: id, date, putterId: 'p', holeCount: 18, finished: true, holes } as Round;
}

const history = Array.from({ length: 9 }, (_, i) => round(`r${i}`, `2026-10-${String(i + 1).padStart(2, '0')}`, 2));

describe('roundRanks', () => {
  it('ranks a round against every other one and names the pool', () => {
    const best = round('best', '2026-11-01', 8);
    const fewest = roundRanks(best, [...history, best], B).find((l) => l.key === 'putts')!;
    expect(fewest.rank).toBe(1);
    expect(rankText(fewest)).toBe('Your best of 10 rounds');
  });

  it('keeps a number most rounds share out of the headline', () => {
    const best = round('best', '2026-11-01', 8);
    const heads = headlineRanks(roundRanks(best, [...history, best], B));
    // Zero three-putts is shared by all ten rounds: a good day, not a record.
    expect(heads.some((l) => l.key === 'threes')).toBe(false);
    expect(heads.some((l) => l.key === 'putts')).toBe(true);
  });

  it('says best since, for a round that is not top three', () => {
    const old = round('old', '2026-09-01', 6);
    const rs = [
      old,
      ...Array.from({ length: 8 }, (_, i) => round(`n${i}`, `2026-10-${10 + i}`, 7 - (i % 2))),
      round('mid', '2026-09-15', 1),
    ];
    const today = round('today', '2026-11-05', 5);
    const all = [...rs, ...Array.from({ length: 6 }, (_, i) => round(`w${i}`, `2026-10-2${i}`, 1)), today];
    const line = roundRanks(today, all, B).find((l) => l.key === 'ones')!;
    expect(line.rank).toBeGreaterThan(3);
    expect(line.since?.rounds).toBeGreaterThanOrEqual(5);
  });

  it('needs eight rounds before it ranks anything', () => {
    const few = history.slice(0, 5);
    expect(roundRanks(few[0], few, B)).toEqual([]);
  });

  it('lists every round best first, ties sharing a place', () => {
    const list = rankedBy([...history, round('x', '2026-11-02', 5)], B, 'ones', 18)!;
    expect(list.rows[0].round.id).toBe('x');
    expect(list.rows.slice(1).every((r) => r.place === 2)).toBe(true);
  });
});

describe('ninesOf', () => {
  const base = { id: 'r', label: '', date: '2026-11-01', putterId: 'p', holeCount: 18, holes: [] } as unknown as Round;
  it('drops a combo tee that was split into nines', () => {
    expect(ninesOf({ ...base, tee: 'Black / Gold', firstNine: 'Black', secondNine: 'Gold' })).toBe('');
    expect(ninesOf({ ...base, tee: 'Goat (L/W)', firstNine: 'Goat (L', secondNine: 'W)' })).toBe('');
  });
  it('keeps real nines', () => {
    expect(
      ninesOf({ ...base, courseId: 'builtin-ives-grove', tee: 'Red/White', firstNine: 'Red', secondNine: 'White' }),
    ).toBe('Red/White');
    expect(ninesOf({ ...base, firstNine: 'Blue', secondNine: 'Red' })).toBe('Blue/Red');
  });
});
