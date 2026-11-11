import { describe, expect, it } from 'vitest';
import { atLeast, momentsOf, oddsText, puttsAtMost, runOf, shapeWords } from './moments';
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

const twoPutts = (from: number, n = 9) => Array.from({ length: n }, (_, i) => hole(i + 1, [[from, false], [2, true]]));

describe('the odds math', () => {
  it('counts at least k successes exactly', () => {
    expect(atLeast([0.5, 0.5], 1)).toBeCloseTo(0.75);
    expect(atLeast([0.5, 0.5], 2)).toBeCloseTo(0.25);
    expect(atLeast([0.2, 0.2, 0.2], 0)).toBeCloseTo(1);
  });
  it('finds a run anywhere in the sequence', () => {
    expect(runOf([0.5, 0.5], 2)).toBeCloseTo(0.25);
    expect(runOf([0.5, 0.5, 0.5], 2)).toBeCloseTo(0.375);
    expect(runOf([1, 0, 1], 2)).toBeCloseTo(0);
  });
  it('adds up putts hole by hole', () => {
    expect(puttsAtMost([{ one: 0.5, three: 0 }], 1)).toBeCloseTo(0.5);
    expect(puttsAtMost([{ one: 0.5, three: 0 }, { one: 0.5, three: 0 }], 3)).toBeCloseTo(0.75);
  });
  it('rounds odds to numbers people say', () => {
    expect(oddsText(1 / 7.4)).toBe('1 in 7');
    expect(oddsText(1 / 26)).toBe('1 in 25');
    expect(oddsText(1 / 230)).toBe('1 in 250');
    expect(oddsText(1 / 5000)).toBe('1 in 1,000+');
  });
});

describe('moments', () => {
  it('puts an ace above everything', () => {
    const r = rnd('a', '2026-11-01', [hole(1, [], 3, 1), ...twoPutts(20, 8).map((h, i) => ({ ...h, hole: i + 2 }))]);
    r.holes[0].holedOut = true;
    const m = momentsOf(r, [r], BASE, chance);
    expect(m[0].kind).toBe('ace');
    expect(m[0].odds).toBe('Career');
  });

  it('prices a long make against every putt as long that day', () => {
    const holes = twoPutts(5);
    holes[3] = hole(4, [[30, true]]);
    const lone = momentsOf(rnd('a', '2026-11-01', holes), [], BASE, chance).find((x) => x.kind === 'longshot')!;
    expect(lone.p).toBeCloseTo(0.01);
    const many = twoPutts(30);
    many[3] = hole(4, [[30, true]]);
    const crowded = momentsOf(rnd('b', '2026-11-01', many), [], BASE, chance).find((x) => x.kind === 'longshot')!;
    expect(crowded.p).toBeGreaterThan(lone.p);
  });

  it('shows nothing when nothing in the round beats 1 in 10', () => {
    expect(momentsOf(rnd('a', '2026-11-01', twoPutts(20)), [], BASE, chance)).toEqual([]);
  });

  it('lets a first eagle rank even with no rounds before it', () => {
    const holes = twoPutts(20);
    holes[0] = hole(1, [[4, true]], 5, 3);
    const [first] = momentsOf(rnd('a', '2026-11-01', holes), [], BASE, chance);
    expect([first.kind, first.odds]).toEqual(['eagle', 'First logged']);
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

describe('the new moments', () => {
  it('names a run of rounds with no three-putt', () => {
    const three = (id: string, date: string) => rnd(id, date, [hole(1, [[40, false], [6, false], [1, true]]), ...twoPutts(10, 8).map((h, i) => ({ ...h, hole: i + 2 }))]);
    const clean = (id: string, date: string) => rnd(id, date, twoPutts(10));
    const prior = [three('x', '2026-09-20'), three('y', '2026-09-25'), three('a', '2026-10-01'), three('b', '2026-10-05'), clean('c', '2026-10-10'), clean('d', '2026-10-15')];
    const m = momentsOf(clean('e', '2026-10-20'), [...prior, clean('e', '2026-10-20')], BASE, chance).find((x) => x.kind === 'noThree');
    expect(m?.big).toBe('3');
    expect(m?.line).toContain('No three-putt since Oct 5');
  });

  it('tells a great day once, not three ways', () => {
    const prior = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map((d, i) => rnd(`p${i}`, d, twoPutts(20)));
    const holes = Array.from({ length: 9 }, (_, i) => hole(i + 1, [[12, true]]));
    const m = momentsOf(rnd('a', '2026-11-01', holes), prior, BASE, chance);
    expect(m.filter((x) => ['fewest', 'onePutts', 'bestRound'].includes(x.kind))).toHaveLength(1);
  });
});
