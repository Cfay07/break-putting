import { describe, expect, it } from 'vitest';
import { liveProjection } from './projection';
import type { Hole, Putt, Round } from './types';

const putts = (n: number): Putt[] =>
  Array.from({ length: n }, (_, i) => ({ d: 10 - i * 4, made: i === n - 1 }) as Putt);

/** Holes 1..count. `played` is putts per hole for the holes already done; every hole is a par 4. */
function round(
  id: string,
  played: number[],
  opts: { count?: number; strokes?: number[]; finished?: boolean; date?: string } = {},
): Round {
  const count = opts.count ?? 18;
  const holes: Hole[] = Array.from({ length: count }, (_, i) => ({
    hole: i + 1,
    par: 4,
    putts: i < played.length ? putts(played[i]) : [],
    strokes: opts.strokes?.[i],
  }));
  return {
    id,
    label: id,
    date: opts.date ?? '2026-11-01',
    putterId: 'p',
    holes,
    holeCount: count,
    finished: opts.finished ?? false,
  } as Round;
}

describe('liveProjection', () => {
  it('waits for three holes', () => {
    expect(liveProjection(round('live', [2, 2]), [])).toBeNull();
  });

  it('with no history, carries today pace to the end', () => {
    const p = liveProjection(round('live', [2, 2, 2, 2, 2, 2]), [])!;
    expect(p.putts).toBe(36);
    expect(p.toPar).toBeNull();
  });

  it('leans on the season early and on today late', () => {
    const season = Array.from({ length: 5 }, (_, i) =>
      round(`r${i}`, Array(18).fill(2), { finished: true, date: `2026-10-0${i + 1}` }),
    );
    // Hot start: three one-putts. Season says two a hole.
    const early = liveProjection(round('live', [1, 1, 1]), season)!;
    const late = liveProjection(round('live', Array(15).fill(1)), season)!;
    // Early: today weighs 3/12, so 15 holes at 1.75 on top of 3 is 29 (pace alone says 18, season 33).
    expect(early.putts).toBe(29);
    // Late: today weighs 15/24, so 3 holes at 1.375 on top of 15 is 19.
    expect(late.putts).toBe(19);
  });

  it('projects a score when every played hole is scored and every par is known', () => {
    const live = round('live', [2, 2, 2, 2, 2, 2, 2, 2, 2], { strokes: [4, 5, 4, 4, 5, 4, 4, 4, 4] });
    const p = liveProjection(live, [])!;
    expect(p.toPar).toBe(4);
    expect(p.score).toBe(76);
  });

  it('leaves the score out when a played hole has no score', () => {
    const live = round('live', [2, 2, 2, 2], { strokes: [4, 4, 4] });
    expect(liveProjection(live, [])!.toPar).toBeNull();
  });

  it('ignores the live round itself in the history', () => {
    const live = round('live', [3, 3, 3]);
    expect(liveProjection(live, [{ ...live, finished: true }])!.putts).toBe(54);
  });
});
