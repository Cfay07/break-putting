import { expectedPutts, puttSG } from './sg';
import { holeVsPar, type Hole, type Putt, type Round } from './types';

export const BUCKETS = [
  { key: 'tapin', label: 'Tap-in ≤2', max: 2 },
  { key: 'b35', label: '3-5 ft', max: 5 },
  { key: 'b68', label: '6-8 ft', max: 8 },
  { key: 'b915', label: '9-15 ft', max: 15 },
  { key: 'b1630', label: '16-30 ft', max: 30 },
  { key: 'b3140', label: '31-40 ft', max: 40 },
  { key: 'b4150', label: '41-50 ft', max: 50 },
  { key: 'b5160', label: '51-60 ft', max: 60 },
  { key: 'b61', label: '61+ ft', max: Infinity },
] as const;

/** A lag putt counts as good if the leave is inside a tenth of the putt: 6 feet from 60, 4 from 40. */
export const LEAVE_STANDARD = 0.1;
export const LAG_FROM = 30;

export const SCORING_MIN = 3;
export const SCORING_MAX = 10;

export type BucketKey = (typeof BUCKETS)[number]['key'];

export function bucketOf(d: number): BucketKey {
  for (const b of BUCKETS) if (d <= b.max) return b.key;
  return 'b61';
}

export interface Tally {
  makes: number;
  attempts: number;
  sg: number;
  sgPutts: number;
}

export interface Pattern {
  high: number;
  low: number;
  online: number;
  short: number;
  good: number;
  long: number;
  push: number;
  pull: number;
  lip: number;
  chunk: number;
  tagged: number;
  byBucket: Record<BucketKey, { high: number; low: number; online: number }>;
}

export interface Stats {
  totalPutts: number;
  holesPlayed: number;
  puttsPerHole: number;
  onePutts: number;
  twoPutts: number;
  threePlus: number;
  threePuttHoles: number[];
  buckets: Record<BucketKey, Tally>;
  scoring: Tally;
  avgLeave: number | null;
  avgLeavePct: number | null;
  lagAttempts: number;
  lagInside: number;
  lipOuts: number;
  chunks: number;
  sg: number;
  makesTotalFeet: number;
  gir: number;
  scoredHoles: number;
  pattern: Pattern;
}

function emptyTally(): Tally {
  return { makes: 0, attempts: 0, sg: 0, sgPutts: 0 };
}

function emptyBuckets(): Record<BucketKey, Tally> {
  return {
    tapin: emptyTally(),
    b35: emptyTally(),
    b68: emptyTally(),
    b915: emptyTally(),
    b1630: emptyTally(),
    b3140: emptyTally(),
    b4150: emptyTally(),
    b5160: emptyTally(),
    b61: emptyTally(),
  };
}

function emptyPattern(): Pattern {
  return {
    high: 0, low: 0, online: 0,
    short: 0, good: 0, long: 0,
    push: 0, pull: 0, lip: 0, chunk: 0, tagged: 0,
    byBucket: {
      tapin: { high: 0, low: 0, online: 0 },
      b35: { high: 0, low: 0, online: 0 },
      b68: { high: 0, low: 0, online: 0 },
      b915: { high: 0, low: 0, online: 0 },
      b1630: { high: 0, low: 0, online: 0 },
      b3140: { high: 0, low: 0, online: 0 },
      b4150: { high: 0, low: 0, online: 0 },
      b5160: { high: 0, low: 0, online: 0 },
      b61: { high: 0, low: 0, online: 0 },
    },
  };
}

export function pct(t: Tally): number | null {
  return t.attempts ? (t.makes / t.attempts) * 100 : null;
}

export function statsForHoles(holes: Hole[], baseline: [number, number][]): Stats {
  const played = holes.filter((h) => h.putts.length > 0);
  const buckets = emptyBuckets();
  const pattern = emptyPattern();
  const scoring: Tally = emptyTally();
  const lagPutts: { d: number; leave: number }[] = [];

  let totalPutts = 0;
  let onePutts = 0;
  let twoPutts = 0;
  let threePlus = 0;
  let lipOuts = 0;
  let chunks = 0;
  let sg = 0;
  let makesTotalFeet = 0;
  let gir = 0;
  let scoredHoles = 0;
  const threePuttHoles: number[] = [];

  for (const h of played) {
    const n = h.putts.length;
    totalPutts += n;
    if (n === 1) onePutts++;
    else if (n === 2) twoPutts++;
    else {
      threePlus++;
      threePuttHoles.push(h.hole);
    }

    sg += expectedPutts(baseline, h.putts[0].d) - n;

    if (h.putts[0].d >= LAG_FROM) {
      lagPutts.push({ d: h.putts[0].d, leave: n > 1 ? h.putts[1].d : 0 });
    }

    const vsPar = holeVsPar(h);
    if (vsPar !== undefined) {
      scoredHoles++;
      if (n - vsPar >= 2) gir++;
    }

    for (const [i, p] of h.putts.entries()) {
      const b = bucketOf(p.d);
      const leave = p.made ? null : (h.putts[i + 1]?.d ?? null);
      const gained = puttSG(baseline, p.d, p.made, leave);
      buckets[b].attempts++;
      if (gained !== null) {
        buckets[b].sg += gained;
        buckets[b].sgPutts++;
      }
      if (p.made) {
        buckets[b].makes++;
        makesTotalFeet += p.d;
      }
      if (p.d >= SCORING_MIN && p.d <= SCORING_MAX) {
        scoring.attempts++;
        if (p.made) scoring.makes++;
        if (gained !== null) {
          scoring.sg += gained;
          scoring.sgPutts++;
        }
      }
      if (p.lip) { pattern.lip++; lipOuts++; }
      if (p.chunk) { pattern.chunk++; chunks++; }
      if (p.push) pattern.push++;
      if (p.pull) pattern.pull++;
      if (p.missSide) {
        pattern[p.missSide]++;
        pattern.byBucket[b][p.missSide]++;
        pattern.tagged++;
      }
      if (p.speed) pattern[p.speed]++;
    }
  }

  return {
    totalPutts,
    holesPlayed: played.length,
    puttsPerHole: played.length ? totalPutts / played.length : 0,
    onePutts,
    twoPutts,
    threePlus,
    threePuttHoles,
    buckets,
    scoring,
    avgLeave: lagPutts.length
      ? lagPutts.reduce((a, b) => a + b.leave, 0) / lagPutts.length
      : null,
    avgLeavePct: lagPutts.length
      ? (lagPutts.reduce((a, b) => a + b.leave / b.d, 0) / lagPutts.length) * 100
      : null,
    lagAttempts: lagPutts.length,
    lagInside: lagPutts.filter((l) => l.leave <= l.d * LEAVE_STANDARD).length,
    lipOuts,
    chunks,
    sg,
    makesTotalFeet,
    gir,
    scoredHoles,
    pattern,
  };
}

export function roundStats(round: Round, baseline: [number, number][]): Stats {
  return statsForHoles(round.holes, baseline);
}

export interface RoundPoint {
  round: Round;
  stats: Stats;
  /** Nine-hole rounds count double so every per-round number is on an eighteen-hole footing. */
  scale: number;
}

export function roundScale(r: Round): number {
  return r.holeCount === 9 ? 2 : 1;
}

export interface Overall {
  rounds: number;
  pooled: Stats;
  puttsPerRound: number | null;
  threePuttsPerRound: number | null;
  sgPerRound: number | null;
  scoringPct: number | null;
  girPerRound: number | null;
  points: RoundPoint[];
}

export function overall(rounds: Round[], baseline: [number, number][]): Overall {
  const points = rounds.map((round) => ({
    round,
    stats: roundStats(round, baseline),
    scale: roundScale(round),
  }));
  const pooled = statsForHoles(rounds.flatMap((r) => r.holes), baseline);
  const n = points.length;
  const avg = (pick: (p: RoundPoint) => number) =>
    n ? points.reduce((s, p) => s + pick(p), 0) / n : null;

  return {
    rounds: n,
    pooled,
    puttsPerRound: avg((p) => p.stats.totalPutts * p.scale),
    threePuttsPerRound: avg((p) => p.stats.threePlus * p.scale),
    sgPerRound: avg((p) => p.stats.sg * p.scale),
    scoringPct: pct(pooled.scoring),
    girPerRound: points.some((p) => p.stats.scoredHoles > 0)
      ? avg((p) => p.stats.gir * p.scale)
      : null,
    points,
  };
}

export interface CourseSplit {
  label: string;
  rounds: number;
  putts: number;
  threePlus: number;
  sg: number;
}

/** "Ives Grove (Blue/Red)", or "Ives Grove (9)" for a nine-hole round. */
export function courseLabel(r: Round): string {
  const parts = [r.course?.trim() || 'Course not named'];
  const nines = [r.firstNine, r.secondNine].filter(Boolean).join('/');
  if (nines) parts.push(`(${nines})`);
  if (r.holeCount === 9) parts.push('(9)');
  return parts.join(' ');
}

/** Every course layout played, with the numbers put on an eighteen-hole footing. */
export function byCourse(rounds: Round[], baseline: [number, number][]): CourseSplit[] {
  const groups = new Map<string, Round[]>();
  for (const r of rounds) {
    const label = courseLabel(r);
    groups.set(label, [...(groups.get(label) ?? []), r]);
  }

  return [...groups.entries()]
    .map(([label, rs]) => {
      const n = rs.length;
      const scale = (rs[0].holeCount === 9 ? 2 : 1) / n;
      const stats = statsForHoles(rs.flatMap((r) => r.holes), baseline);
      return {
        label,
        rounds: n,
        putts: stats.totalPutts * scale,
        threePlus: stats.threePlus * scale,
        sg: stats.sg * scale,
      };
    })
    .sort((a, b) => b.rounds - a.rounds || a.label.localeCompare(b.label));
}

export function allPutts(rounds: Round[]): Putt[] {
  return rounds.flatMap((r) => r.holes.flatMap((h) => h.putts));
}
