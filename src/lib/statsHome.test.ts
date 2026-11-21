import { describe, expect, it } from 'vitest';
import { recentSplit, rowNumber, shootSplit } from './statsHome';
import { DEFAULT_BASELINE, type Putt, type Round } from './types';

const B = DEFAULT_BASELINE;
const putt = (d: number, made = false) => ({ d, made }) as Putt;

function round(id: string, date: string, misses: number): Round {
  return {
    id,
    date,
    finished: true,
    putterId: 'p',
    score: 54 + misses * 2,
    holes: Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      par: 4,
      strokes: i < misses ? 5 : 3,
      putts: i < misses ? [putt(4), putt(1, true)] : [putt(4, true)],
    })),
  } as unknown as Round;
}

describe('stats home', () => {
  const rounds = Array.from({ length: 16 }, (_, i) => round(`r${i}`, `2026-10-${String(i + 1).padStart(2, '0')}`, i < 6 ? 4 : 1));

  it('splits the gap to tour putting into pieces that add up to it exactly', () => {
    const s = shootSplit(rounds, B)!;
    const pieces = s.pieces.reduce((a, p) => a + p.sg, 0);
    expect(s.shoot - s.withTour).toBeCloseTo(-pieces, 6);
  });

  it('compares the last ten with the rounds before only when there are enough', () => {
    expect(recentSplit(rounds.slice(0, 14))).toBeNull();
    const split = recentSplit(rounds)!;
    expect(split.recent).toHaveLength(10);
    expect(split.before).toHaveLength(6);
    const short = rowNumber('short', rounds, split, B)!;
    expect(short.now).toBeGreaterThan(short.before!);
  });
});
