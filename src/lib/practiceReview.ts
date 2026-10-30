import { BANDS, PATTERN_NEED } from './pinpoint';
import { expectedPutts } from './sg';
import type { DrillDef, MissDir, PracticeSet, Round, Surface } from './types';
import { TEST_ID } from './weeklyTest';

/**
 * What only practice can show: whether the test is moving, whether the same putt over and over
 * flatters you, which way practice misses go, and how you hold up when a miss costs the run.
 * None of it is ever mixed into a round number.
 */

const scratchMake = (baseline: [number, number][], d: number) => Math.min(1, Math.max(0, 2 - expectedPutts(baseline, d)));

/** Six weekly tests before a change can be told apart from a good or bad week. */
export const TREND_TESTS = 6;

export interface TestTrend {
  /** Average balls a test, first three against last three. */
  first: number;
  last: number;
  beyond: boolean;
}

export function testTrend(weeks: PracticeSet[]): TestTrend | null {
  if (weeks.length < TREND_TESTS) return null;
  const sum = (xs: PracticeSet[]) => xs.reduce((n, s) => ({ made: n.made + s.made, of: n.of + s.attempts }), { made: 0, of: 0 });
  const a = sum(weeks.slice(0, 3));
  const b = sum(weeks.slice(-3));
  const p1 = a.made / a.of;
  const p2 = b.made / b.of;
  const margin = 1.96 * Math.sqrt((p1 * (1 - p1)) / a.of + (p2 * (1 - p2)) / b.of);
  return { first: a.made / 3, last: b.made / 3, beyond: Math.abs(p2 - p1) > margin };
}

export interface SpotTally {
  made: number;
  attempts: number;
  /** What a scratch golfer holes from the same putts, so a mix of distances is a fair fight. */
  scratch: number;
}

/** Each side needs this many putts from 3 to 10 ft before the two are put side by side. */
export const SPOT_NEED = 20;

/**
 * The same putt over and over against putts that change every ball. Mixed means the weekly test
 * and practice rounds: nothing else in practice changes the putt every time, the way a course does.
 */
export function spotVsMixed(
  sets: PracticeSet[],
  practiceRounds: Round[],
  surface: Surface,
  baseline: [number, number][],
): { same: SpotTally; mixed: SpotTally } {
  const same: SpotTally = { made: 0, attempts: 0, scratch: 0 };
  const mixed: SpotTally = { made: 0, attempts: 0, scratch: 0 };
  const add = (t: SpotTally, d: number, made: number, attempts: number) => {
    t.made += made;
    t.attempts += attempts;
    t.scratch += attempts * scratchMake(baseline, d);
  };
  for (const s of sets) {
    if (s.surface !== surface) continue;
    const stations = s.stations ?? [];
    const one = new Set(stations.map((x) => x.d)).size === 1;
    const t = s.drill === TEST_ID ? mixed : one ? same : null;
    if (!t) continue;
    for (const x of stations) {
      if (x.mode === 'make' && !x.hand && x.d >= 3 && x.d <= 10) add(t, x.d, x.made, x.attempts);
    }
  }
  for (const r of practiceRounds) {
    if (!r.finished || r.practice?.surface !== surface) continue;
    for (const h of r.holes) {
      const p = h.putts[0];
      if (p && p.d >= 3 && p.d <= 10) add(mixed, p.d, p.made ? 1 : 0, 1);
    }
  }
  return { same, mixed };
}

export interface MissBand {
  label: string;
  total: number;
  dirs: Record<MissDir, number>;
}

/** Every tagged practice miss on a surface, by distance band. A band speaks from PATTERN_NEED misses. */
export function missBands(sets: PracticeSet[], surface: Surface): MissBand[] {
  return BANDS.map((b) => {
    const dirs: Record<MissDir, number> = { left: 0, right: 0, short: 0, long: 0 };
    for (const s of sets) {
      if (s.surface !== surface) continue;
      for (const st of s.stations ?? []) {
        if (st.d < b.lo || st.d > b.hi || !st.misses) continue;
        for (const [k, n] of Object.entries(st.misses) as [MissDir, number][]) dirs[k] += n;
      }
    }
    return { label: b.label, total: dirs.left + dirs.right + dirs.short + dirs.long, dirs };
  }).filter((b) => b.total >= PATTERN_NEED);
}

/** Streak drills are where a miss costs something, so they are the practice that feels like the course. */
export function pressureOf(sets: PracticeSet[], resolve: (id: string) => DrillDef | undefined) {
  let tried = 0;
  let finished = 0;
  let streaks = 0;
  let best: { run: number; drill: string; d: number } | null = null;
  for (const s of sets) {
    const d = resolve(s.drill);
    if (d?.scoring !== 'streak') continue;
    streaks++;
    if (d.target) {
      tried++;
      if (s.finished) finished++;
    }
    const run = s.run ?? s.made;
    if (!best || run > best.run) best = { run, drill: d.name, d: d.stations[0]?.d ?? 0 };
  }
  return { streaks, tried, finished, best };
}
