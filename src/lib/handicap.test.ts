import { describe, expect, it } from 'vitest';
import { differentials, fmtIndex, indexAt, indexMove, indexOf } from './handicap';
import { backTeeFor } from './courses';
import type { Round, SavedCourse } from './types';

const course: SavedCourse = {
  id: 'c',
  name: 'Test Links',
  tees: [
    { name: 'Blue', rating: 72, slope: 113, pars: Array(18).fill(4) },
    { name: 'Nine', rating: 36, slope: 113, pars: Array(9).fill(4) },
  ],
} as unknown as SavedCourse;

/** A round where every hole takes `per` strokes, off the given tee. */
function round(id: string, date: string, per: number | number[], tee = 'Blue', holes = 18): Round {
  const strokes = Array.isArray(per) ? per : Array(holes).fill(per);
  return {
    id,
    label: id,
    date,
    putterId: 'p',
    courseId: 'c',
    tee,
    finished: true,
    holeCount: holes,
    holes: strokes.map((s, i) => ({ hole: i + 1, par: 4, strokes: s, putts: [] })),
  } as unknown as Round;
}

describe('handicap', () => {
  it('scores a differential as (113 / slope) x (score - rating)', () => {
    const [d] = differentials([round('a', '2026-10-01', 4)], [course]);
    expect(d.value).toBe(0);
  });

  it('caps a blow-up hole at double bogey', () => {
    const blow = [12, ...Array(17).fill(4)];
    const [d] = differentials([round('a', '2026-10-01', blow)], [course]);
    expect(d.value).toBe(2);
  });

  it('joins two nines into one eighteen', () => {
    const ds = differentials(
      [round('a', '2026-10-01', 5, 'Nine', 9), round('b', '2026-10-02', 4, 'Nine', 9)],
      [course],
    );
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ id: 'a+b', nines: true, value: 9 });
  });

  it('leaves out a round with no known tee rather than guessing one', () => {
    const r = { ...round('a', '2026-10-01', 4), tee: undefined } as Round;
    expect(differentials([r], [course])).toEqual([]);
  });

  it('needs three scores, and uses the lowest one less two with exactly three', () => {
    const d = (v: number, i: number) => ({ id: String(i), date: `2026-10-0${i + 1}`, value: v, nines: false });
    expect(indexOf([d(5, 0), d(6, 1)])).toBeNull();
    expect(indexOf([d(5, 0), d(6, 1), d(7, 2)])).toBe(3);
  });

  it('averages the best 8 of the last 20', () => {
    const ds = Array.from({ length: 20 }, (_, i) => ({ id: String(i), date: '2026-10-01', value: i, nines: false }));
    expect(indexOf(ds)).toBe(3.5);
  });

  it('shows the index as of a round, counting only what came before it', () => {
    const rs = [5, 6, 7, 4].map((per, i) =>
      round(
        `r${i}`,
        `2026-10-0${i + 1}`,
        Array(18)
          .fill(per)
          .map((s, j) => (j < 2 ? s : 4)),
      ),
    );
    expect(indexAt(rs[2], rs, [course])).toBe(indexOf(differentials(rs.slice(0, 3), [course])));
  });

  it('writes a plus handicap the golf way', () => {
    expect(fmtIndex(-1.2)).toBe('+1.2');
    expect(fmtIndex(4.8)).toBe('4.8');
  });

  it('says how far a round moved the index, better as negative', () => {
    const rs = [6, 6, 6, 4].map((per, i) =>
      round(
        `r${i}`,
        `2026-10-0${i + 1}`,
        Array(18)
          .fill(4)
          .map((s, j) => (j < 2 ? per : s)),
      ),
    );
    expect(indexMove(rs[0], rs, [course])).toBeNull();
    expect(indexMove(rs[3], rs, [course])).toBeLessThan(0);
  });
});

describe('backTeeFor', () => {
  const two: SavedCourse = {
    id: 'two',
    name: 'Two Tee Club',
    tees: [
      { name: 'White', yards: 6100, rating: 69, slope: 120, pars: Array(18).fill(4) },
      { name: 'Black', yards: 6900, rating: 73, slope: 133, pars: Array(18).fill(4) },
      { name: 'Red (W)', yards: 7000, rating: 75, slope: 135, pars: Array(18).fill(4) },
    ],
  } as unknown as SavedCourse;
  const bare = {
    id: 'b',
    label: 'b',
    date: '2026-08-01',
    putterId: 'p',
    course: 'Two Tee Club',
    holeCount: 18,
    holes: [],
  } as unknown as Round;

  it("takes the longest rated men's tee for a round with none", () => {
    expect(backTeeFor(bare, [two])?.tee.name).toBe('Black');
  });
  it('never replaces a tee you picked', () => {
    expect(backTeeFor({ ...bare, tee: 'White' } as Round, [two])).toBeNull();
  });
});
