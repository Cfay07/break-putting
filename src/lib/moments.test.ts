import { describe, expect, it } from 'vitest';
import { momentsOf, shapeWords } from './moments';
import type { Hole, Putt, Round } from './types';

const BASE: [number, number][] = [
  [1, 1],
  [3, 1.05],
  [5, 1.25],
  [10, 1.6],
  [20, 1.85],
  [40, 2.05],
  [60, 2.2],
];

const chance = (p: Putt) => Math.max(0.01, Math.min(0.99, 1.2 - p.d / 8));

function hole(n: number, putts: [number, boolean][], par = 4, strokes?: number): Hole {
  return { hole: n, par, strokes: strokes ?? par, putts: putts.map(([d, made]) => ({ d, made })) };
}

function rnd(id: string, date: string, holes: Hole[], extra: Partial<Round> = {}): Round {
  return { id, label: id, date, putterId: 'p', holeCount: 18, holes, finished: true, ...extra } as Round;
}

const twoPutts = (from: number, n = 9) =>
  Array.from({ length: n }, (_, i) => hole(i + 1, [[from, false], [2, true]]));

describe('moments', () => {
  it('puts an ace above everything and keeps one card per hole', () => {
    const r = rnd('a', '2026-11-01', [hole(1, [], 3, 1), ...twoPutts(20, 8).map((h, i) => ({ ...h, hole: i + 2 }))]);
    r.holes[0].holedOut = true;
    const m = momentsOf(r, [r], BASE, chance);
    expect(m[0].kind).toBe('ace');
    expect(new Set(m.map((x) => x.hole).filter(Boolean)).size).toBe(m.filter((x) => x.hole).length);
  });

  it('names a long make by its make chance', () => {
    const holes = twoPutts(20);
    holes[3] = hole(4, [[30, true]]);
    const [first] = momentsOf(rnd('a', '2026-11-01', holes), [], BASE, chance);
    expect(first.kind).toBe('longshot');
    expect(first.big).toBe('30');
    expect(first.line).toContain('1%');
  });

  it('shows at most three, and only one lowlight', () => {
    const holes = twoPutts(20);
    holes[0] = hole(1, [[30, true]]);
    holes[1] = hole(2, [[1, false], [1, true]]);
    holes[2] = hole(3, [[2, false], [1, true]]);
    const m = momentsOf(rnd('a', '2026-11-01', holes), [], BASE, chance);
    expect(m.length).toBeLessThanOrEqual(3);
    expect(m.filter((x) => x.low)).toHaveLength(1);
  });

  it('calls a new best only against rounds of the same length', () => {
    const prior = ['2026-10-01', '2026-10-02', '2026-10-03'].map((d, i) => rnd(`p${i}`, d, twoPutts(20)));
    const holes = twoPutts(20);
    holes[0] = hole(1, [[4, true]]);
    const m = momentsOf(rnd('a', '2026-11-01', holes), prior, BASE, chance);
    expect(m.find((x) => x.kind === 'fewest')?.line).toContain('old best was 18');
  });

  it('never gives a practice round moments', () => {
    const holes = twoPutts(20);
    holes[0] = hole(1, [[30, true]]);
    expect(momentsOf(rnd('a', '2026-11-01', holes, { practice: { surface: 'indoor' } } as Partial<Round>), [], BASE, chance)).toEqual([]);
  });

  it('describes the shape of a putt in plain words', () => {
    expect(shapeWords(['uphill', 'L→R', 'R→L'])).toBe('Uphill, breaks both ways.');
    expect(shapeWords(['R→L'])).toBe('Right to left.');
    expect(shapeWords([])).toBe('');
  });
});
