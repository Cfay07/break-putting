import { describe, expect, it } from 'vitest';
import { roundStreaks, streaks } from './streaks';
import { DEFAULT_BASELINE, type Putt, type Round } from './types';

const B = DEFAULT_BASELINE;
const putts = (n: number): Putt[] => Array.from({ length: n }, (_, i) => ({ d: 10, made: i === n - 1 }) as Putt);

/** Nine par 4s, two putts each, with a three-putt on the first hole when asked. */
function round(id: string, date: string, threePutt = false): Round {
  return {
    id,
    label: id,
    date,
    putterId: 'p',
    holeCount: 9,
    finished: true,
    holes: Array.from({ length: 9 }, (_, i) => {
      const n = threePutt && i === 0 ? 3 : 2;
      return { hole: i + 1, par: 4, strokes: 2 + n, putts: putts(n) };
    }),
  } as unknown as Round;
}

describe('streaks', () => {
  const rs = [
    round('a', '2026-10-01'),
    round('b', '2026-10-02'),
    round('c', '2026-10-03', true),
    round('d', '2026-10-04'),
    round('e', '2026-10-05'),
    round('f', '2026-10-06'),
  ];
  const nothree = streaks(rs, B).find((s) => s.key === 'nothree')!;

  it('counts the current run and keeps the best one', () => {
    expect(nothree.current).toBe(3);
    expect(nothree.since?.id).toBe('d');
    expect(nothree.best).toBe(3);
  });

  it('skips a round that has nothing to judge, without ending the run', () => {
    const noShort = streaks(rs, B).find((s) => s.key === 'inside3')!;
    expect(noShort.current).toBe(0);
    expect(noShort.best).toBe(0);
  });

  it('names a run on a round from its third round on', () => {
    expect(roundStreaks(rs[5], rs, B).find((s) => s.key === 'nothree')?.n).toBe(3);
    expect(roundStreaks(rs[4], rs, B).find((s) => s.key === 'nothree')).toBeUndefined();
  });
});
