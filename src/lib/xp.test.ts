import { describe, expect, it } from 'vitest';
import { DEFAULT_BASELINE, type BreakDir, type Putt } from './types';
import { expectedPutts, holeSG } from './sg';
import { fitMakeModel } from './makeability';
import { holeAdjustments, puttSGAdjusted, severityOf, xpOf } from './xp';

const B = DEFAULT_BASELINE;

const putt = (d: number, made: boolean, dirs: BreakDir[] = [], brokeAs?: number): Putt =>
  ({ d, made, ...(dirs.length ? { breakDirs: dirs } : {}), ...(brokeAs ? { brokeAs } : {}) }) as Putt;

/** A model fitted on enough synthetic break for stage two to actually turn on. */
function model() {
  const holes = [];
  for (let i = 0; i < 260; i++) {
    const d = 3 + (i % 28);
    const dirs: BreakDir[] = i % 3 === 0 ? ['L→R'] : i % 3 === 1 ? ['R→L', 'downhill'] : ['straight'];
    const made = (i % 7 === 0 && d < 12) || d < 4;
    holes.push({ hole: (i % 18) + 1, putts: [{ ...putt(d, made, dirs, (i % 4) + 1) }] });
  }
  return fitMakeModel([{ id: 'x', label: 'x', date: '2026-01-01', putterId: 'p', holeCount: 18, holes, finished: true } as never]);
}
const M = model();

describe('xP', () => {
  it('never drops below one putt', () => {
    for (const d of [1, 2, 3, 6, 20, 60, 120]) {
      const v = xpOf(M, B, putt(d, false));
      if (v !== null) expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  it('equals the distance-only baseline when there is no shape to read', () => {
    for (const d of [4, 8, 15, 30]) {
      const v = xpOf(M, B, putt(d, false));
      if (v !== null) expect(Math.abs(v - expectedPutts(B, d))).toBeLessThan(0.08);
    }
  });

  it('reads severity off what it did, not off the read', () => {
    expect(severityOf({ d: 8, made: false, breakDirs: ['L→R'], readAs: 1, brokeAs: 4 } as Putt)).toBe(4);
    expect(severityOf({ d: 8, made: false, breakDirs: ['straight'], brokeAs: 3 } as Putt)).toBeUndefined();
  });

  it('keeps rising past the end of the table rather than tying every long putt', () => {
    expect(expectedPutts(B, 77)).toBeGreaterThan(expectedPutts(B, 60));
  });
});

describe('adjustments telescope', () => {
  const cases: [string, Putt[]][] = [
    ['one putt', [putt(6, true, ['L→R'], 2)]],
    ['breaking leftover', [putt(22, false, ['R→L', 'downhill'], 3), putt(6, true, ['L→R', 'downhill'], 2)]],
    ['straight leftover', [putt(22, false, ['R→L', 'downhill'], 3), putt(6, true, ['straight'])]],
    ['three putt', [putt(40, false, ['L→R'], 2), putt(9, false, ['R→L'], 1), putt(2, true)]],
    ['four putt', [putt(55, false, ['L→R'], 3), putt(14, false, ['R→L'], 2), putt(5, false, ['straight']), putt(2, true)]],
    ['no conditions at all', [putt(18, false), putt(3, true)]],
  ];

  for (const [name, putts] of cases) {
    it(`${name}: per-putt adjustments sum to the first putt's`, () => {
      const adj = holeAdjustments(M, B, putts);
      if (adj.some((a) => a === null)) return;
      const total = (adj as number[]).reduce((s, a) => s + a, 0);
      const first = (xpOf(M, B, putts[0]) as number) - expectedPutts(B, putts[0].d);
      expect(total).toBeCloseTo(first, 10);
    });

    it(`${name}: per-putt SG sums to the hole`, () => {
      const each = putts.map((_, i) => puttSGAdjusted(M, B, putts, i));
      if (each.some((v) => v === null)) return;
      const total = (each as number[]).reduce((s, v) => s + v, 0);
      const hole = (xpOf(M, B, putts[0]) as number) - putts.length;
      expect(total).toBeCloseTo(hole, 10);
    });
  }

  it('a breaking leftover is charged differently from a straight one', () => {
    const lag = putt(22, false, ['R→L', 'downhill'], 3);
    const straight = holeAdjustments(M, B, [lag, putt(6, true, ['straight'])])[0];
    const breaking = holeAdjustments(M, B, [lag, putt(6, true, ['L→R', 'downhill'], 2)])[0];
    if (straight === null || breaking === null) return;
    expect(straight).not.toBeCloseTo(breaking, 3);
  });
});

describe('the old distance-only path is untouched', () => {
  it('holeSG still equals first-putt expectation minus putts taken', () => {
    expect(holeSG(B, [22, 6], 2)).toBeCloseTo(expectedPutts(B, 22) - 2, 12);
  });
});

describe('under-sampled shapes do not price putts', () => {
  it('a shape below MIN_TERM is ignored by makeability', async () => {
    const { fitMakeModel, makeability, MIN_TERM } = await import('./makeability');
    const holes = [];
    // 200 one-way putts, and only a handful of double breakers.
    for (let i = 0; i < 200; i++) {
      holes.push({
        hole: (i % 18) + 1,
        putts: [{ d: 4 + (i % 25), made: i % 4 === 0, breakDirs: ['L→R'] as BreakDir[] }],
      });
    }
    for (let i = 0; i < 5; i++) {
      holes.push({
        hole: 1,
        putts: [{ d: 10, made: false, breakDirs: ['L→R', 'R→L'] as BreakDir[] }],
      });
    }
    const m = fitMakeModel([
      { id: 'x', label: 'x', date: '2026-01-01', putterId: 'p', holeCount: 18, holes, finished: true },
    ] as never);
    expect(m.taggedBy.double).toBeLessThan(MIN_TERM);
    // A double breaker carries only the 'double' term, so gating it falls all the way back to
    // distance alone. That is the honest default: an under-sampled shape says nothing, rather
    // than borrowing a number from a shape it is not.
    const withDouble = makeability(m, 10, ['L→R', 'R→L']);
    const noShape = makeability(m, 10, []);
    expect(withDouble).toBeCloseTo(noShape as number, 10);
    // And a well-sampled shape still moves the number.
    expect(makeability(m, 10, ['L→R'])).not.toBeCloseTo(noShape as number, 4);
  });
});

describe('past the end of the baseline table', () => {
  it('keeps rising instead of flattening into a tie', () => {
    const a = expectedPutts(B, 60);
    const b = expectedPutts(B, 77);
    const c = expectedPutts(B, 95);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    // and not by a silly amount: a 95 footer is not a four-putt
    expect(c).toBeLessThan(a + 0.25);
  });

  it('stops reaching somewhere sane', () => {
    expect(expectedPutts(B, 100)).toBeCloseTo(expectedPutts(B, 400), 10);
  });

  it('is unchanged inside the table', () => {
    for (const d of [3, 7, 12, 25, 40, 59]) {
      expect(expectedPutts(B, d)).toBeGreaterThan(1);
      expect(expectedPutts(B, d)).toBeLessThan(2.25);
    }
  });
});

describe('room to spare', () => {
  it('is widest dead through the front and nil at the lip', async () => {
    const { roomOf, ROOM_MAX } = await import('./xp');
    expect(roomOf('front')).toBeCloseTo(ROOM_MAX, 10);
    expect(roomOf('left')).toBeCloseTo(0, 10);
    expect(roomOf('right')).toBeCloseTo(0, 10);
  });

  it('gives the inside edges something, but less', async () => {
    const { roomOf, ROOM_MAX } = await import('./xp');
    const inside = roomOf('inside-left')!;
    expect(inside).toBeGreaterThan(0);
    expect(inside).toBeLessThan(ROOM_MAX);
    expect(roomOf('inside-right')).toBeCloseTo(inside, 10);
  });

  it('refuses the back half rather than calling it zero', async () => {
    const { roomOf } = await import('./xp');
    expect(roomOf('back')).toBeNull();
    expect(roomOf('back-left')).toBeNull();
    expect(roomOf('back-right')).toBeNull();
    expect(roomOf('unsure')).toBeNull();
    expect(roomOf(undefined)).toBeNull();
  });

  it('is symmetric left and right', async () => {
    const { roomOf } = await import('./xp');
    expect(roomOf('left')).toBeCloseTo(roomOf('right')!, 10);
  });
});
