import { describe, expect, it } from 'vitest';
import { dialAt, dialEnds, holeCard } from './dial';
import { DEFAULT_BASELINE, type Hole, type Putt, type Round } from './types';

const putt = (d: number, made: boolean) => ({ d, made }) as Putt;
const round = (id: string, date: string, course: string, holes: Hole[]) =>
  ({ id, date, course, finished: true, putterId: 'p', holes }) as unknown as Round;

describe('the dial', () => {
  // 45 four-footers, 27 holed; 6 twelve-footers, 2 holed; nothing else.
  const holes: Hole[] = [
    ...Array.from({ length: 45 }, (_, i) => ({ hole: 1, putts: [putt(4, i < 27)] })),
    ...Array.from({ length: 6 }, (_, i) => ({ hole: 2, putts: [putt(12, i < 2)] })),
  ];
  const r = round('a', '2026-11-01', 'Strawberry Creek', holes);

  it('reads one length when it has enough putts', () => {
    expect(dialAt([r], 4)).toMatchObject({ made: 27, tried: 45, lo: 4, hi: 4 });
  });

  it('widens a few feet at most when a length is thin, and says which lengths it counted', () => {
    expect(dialAt([r], 12)).toMatchObject({ made: 2, tried: 6, lo: 9, hi: 15 });
  });

  it('finds the shortest miss and longest make', () => {
    const ends = dialEnds([r]);
    expect(ends.shortestMiss?.d).toBe(4);
    expect(ends.longestMake?.d).toBe(12);
  });
});

describe('hole by hole', () => {
  const hole = (n: number, par: number, strokes: number): Hole => ({
    hole: n,
    par,
    strokes,
    putts: strokes - par >= 1 ? [putt(20, false), putt(2, true)] : [putt(8, true)],
  });
  it('counts eagles, birdies, pars, bogeys and doubles per hole', () => {
    const a = round('a', '2026-11-01', 'Strawberry Creek', [hole(1, 5, 3), hole(2, 4, 6)]);
    const b = round('b', '2026-11-02', 'Strawberry Creek Golf Club', [hole(1, 5, 4), hole(2, 4, 5)]);
    const card = holeCard([a, b], DEFAULT_BASELINE)!.rows;
    expect(card[0]).toMatchObject({
      hole: 1,
      par: 5,
      played: 2,
      eagle: 1,
      birdie: 1,
      avg: 3.5,
      toPar: -1.5,
      longestMake: 8,
    });
    expect(card[1]).toMatchObject({ hole: 2, bogey: 1, double: 1 });
  });

  it('adds up mixed courses by hole number, and says so', () => {
    const a = round('a', '2026-11-01', 'Strawberry Creek', [hole(1, 4, 4)]);
    const b = round('b', '2026-11-02', 'Ives Grove', [hole(1, 5, 6)]);
    const card = holeCard([a, b], DEFAULT_BASELINE)!;
    expect(card.mixed).toBe(true);
    expect(card.rows[0]).toMatchObject({ toPar: 0.5, samePar: false });
  });
});
