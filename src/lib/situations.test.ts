import { describe, expect, it } from 'vitest';
import { byStretch, conversion, tournamentVsCasual } from './situations';
import { DEFAULT_BASELINE, type Putt, type Round } from './types';

const B = DEFAULT_BASELINE;
const putts = (n: number, first = 10): Putt[] =>
  Array.from({ length: n }, (_, i) => ({ d: i === 0 ? first : 2, made: i === n - 1 }) as Putt);

/** Holes as [strokes, putts] on par 4s. */
function round(id: string, holes: [number, number][], competitive = false): Round {
  return {
    id,
    label: id,
    date: '2026-10-01',
    putterId: 'p',
    holeCount: holes.length,
    finished: true,
    competitive,
    holes: holes.map(([strokes, n], i) => ({ hole: i + 1, par: 4, strokes, putts: putts(n) })),
  } as unknown as Round;
}

describe('conversion', () => {
  it('counts birdies on greens hit and pars saved on greens missed', () => {
    // 3 with 1 putt: green hit, birdie. 4 with 2: green hit, par. 4 with 1: missed, saved. 5 with 2: missed, not saved.
    const c = conversion([
      round('a', [
        [3, 1],
        [4, 2],
        [4, 1],
        [5, 2],
      ]),
    ]);
    expect(c).toEqual({ greens: 2, birdies: 1, missed: 2, saves: 1 });
  });

  it('does not call a chip-in a green hit', () => {
    const r = round('a', [[3, 0]]);
    expect(conversion([r])).toMatchObject({ greens: 0, missed: 1, saves: 1 });
  });
});

describe('comparisons', () => {
  it('splits tournament from casual and leaves out an empty side', () => {
    const lines = tournamentVsCasual([round('a', [[4, 2]], true), round('b', [[4, 3]])], B);
    expect(lines.map((l) => [l.label, l.rounds])).toEqual([
      ['Tournament', 1],
      ['Casual', 1],
    ]);
    expect(lines[1].threes).toBe(18);
    expect(tournamentVsCasual([round('a', [[4, 2]])], B)).toHaveLength(1);
  });

  it('reads the first and last three holes in the order played', () => {
    const holes = Array.from({ length: 9 }, (_, i) => [4, i < 3 ? 3 : 2] as [number, number]);
    const lines = byStretch([round('a', holes)], B);
    expect(lines.find((l) => l.label === 'First 3 holes')!.threes).toBe(18);
    expect(lines.find((l) => l.label === 'Last 3 holes')!.threes).toBe(0);
  });

  it('names the spot in the round you lose the most on, once ten rounds stand behind it', () => {
    const holes = Array.from({ length: 9 }, (_, i) => [4, i === 4 ? 3 : 2] as [number, number]);
    const rs = Array.from({ length: 10 }, (_, i) => round(`r${i}`, holes));
    expect(byStretch(rs, B).find((l) => l.label.startsWith('Worst'))!.label).toBe('Worst hole: the 5th');
    expect(byStretch(rs.slice(0, 9), B).some((l) => l.label.startsWith('Worst'))).toBe(false);
  });
});
