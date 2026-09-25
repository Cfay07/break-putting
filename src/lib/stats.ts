import { expectedPutts, puttSG } from './sg';
import {
  breakBucket,
  breakDirsOf,
  holeVsPar,
  holedOut,
  slopeOf,
  type BreakBucket,
  type Hole,
  type Putt,
  type Round,
} from './types';

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
  tagged: number;
  byBucket: Record<BucketKey, { high: number; low: number; online: number }>;
  /** Every tagged putt lands in exactly one break bucket, double breakers included. */
  byBreak: Record<BreakBucket, BreakTally>;
  /**
   * Makes and misses carrying a break tag, counted apart. A make rate built on misses alone
   * would read zero no matter how well you putt, so the table needs both before it can claim
   * anything.
   */
  breakMakes: number;
  breakMisses: number;
  uphill: BreakTally;
  downhill: BreakTally;
}

export interface BreakTally {
  attempts: number;
  makes: number;
  high: number;
  low: number;
}

export interface Stats {
  totalPutts: number;
  /** Putts that did not go in. The denominator for how much of the tagging is filled in. */
  missedPutts: number;
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

function emptyBreak(): BreakTally {
  return { attempts: 0, makes: 0, high: 0, low: 0 };
}

function emptyPattern(): Pattern {
  return {
    high: 0, low: 0, online: 0,
    short: 0, good: 0, long: 0,
    push: 0, pull: 0, lip: 0, tagged: 0,
    breakMakes: 0,
    breakMisses: 0,
    byBreak: {
      lr: emptyBreak(), rl: emptyBreak(), double: emptyBreak(), straight: emptyBreak(),
    },
    uphill: emptyBreak(),
    downhill: emptyBreak(),
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
  // A chip-in never touches the putting numbers, but it is still a green you missed, so it
  // belongs in the greens-in-regulation denominator.
  const chippedIn = holes.filter((h) => holedOut(h) && holeVsPar(h) !== undefined).length;
  const buckets = emptyBuckets();
  const pattern = emptyPattern();
  const scoring: Tally = emptyTally();
  const lagPutts: { d: number; leave: number }[] = [];

  let totalPutts = 0;
  let missedPutts = 0;
  let onePutts = 0;
  let twoPutts = 0;
  let threePlus = 0;
  let lipOuts = 0;
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
      } else {
        missedPutts++;
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
      if (p.push) pattern.push++;
      if (p.pull) pattern.pull++;
      if (p.missSide) {
        pattern[p.missSide]++;
        pattern.byBucket[b][p.missSide]++;
        pattern.tagged++;
      }
      if (p.speed) pattern[p.speed]++;
      const dirs = breakDirsOf(p);
      if (dirs.length) {
        if (p.made) pattern.breakMakes++;
        else pattern.breakMisses++;
      }
      const bucket = breakBucket(dirs);
      const slope = slopeOf(dirs);
      for (const t of [bucket ? pattern.byBreak[bucket] : null, slope ? pattern[slope] : null]) {
        if (!t) continue;
        t.attempts++;
        if (p.made) t.makes++;
        else if (p.missSide === 'high') t.high++;
        else if (p.missSide === 'low') t.low++;
      }
    }
  }

  return {
    totalPutts,
    missedPutts,
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
    sg,
    makesTotalFeet,
    gir,
    scoredHoles: scoredHoles + chippedIn,
    pattern,
  };
}

export function roundStats(round: Round, baseline: [number, number][]): Stats {
  return statsForHoles(round.holes, baseline);
}

export interface RoundPoint {
  round: Round;
  stats: Stats;
  /** Scales a round up to an eighteen-hole footing, so a nine counts double and so does a walk-in. */
  scale: number;
}

/** Holes you actually got to. A chip-in still counts as a hole played. */
export function holesPlayed(r: Round): number {
  return r.holes.filter((h) => h.putts.length > 0 || holedOut(h)).length;
}

/**
 * Measured off the holes played, not the holes you signed up for. Walking in after nine of a
 * declared eighteen is a nine-hole round whatever the setup screen said, and quoting it as a
 * full one drags every per-round average toward it.
 */
export function roundScale(r: Round): number {
  const played = holesPlayed(r);
  return played ? 18 / played : 1;
}

export interface Overall {
  rounds: number;
  pooled: Stats;
  /**
   * Strokes gained per bucket with nine-hole rounds doubled, so this column sums to the same
   * number the Averages card shows. The pooled buckets are raw and stay that way, because
   * make rates must not be double counted.
   */
  bucketSgPerRound: Record<BucketKey, number | null>;
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

  const bucketSgPerRound = {} as Record<BucketKey, number | null>;
  for (const b of BUCKETS) {
    const any = points.some((p) => p.stats.buckets[b.key].sgPutts > 0);
    bucketSgPerRound[b.key] = any
      ? points.reduce((sum, p) => sum + p.stats.buckets[b.key].sg * p.scale, 0) / (n || 1)
      : null;
  }

  return {
    rounds: n,
    pooled,
    bucketSgPerRound,
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
  lastPlayed: string;
  rounds: number;
  putts: number;
  threePlus: number;
  sg: number;
}

/**
 * Courses get typed a dozen ways. "Ives Grove" and "Ives Grove Golf Links" are one place, so
 * grouping ignores the club-type suffix and the casing, while the label keeps the fuller name.
 */
export function courseKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(golf|links|course|club|country|cc|gc|g\.?c\.?)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** "Ives Grove (Blue/Red)", or "Ives Grove (9)" when you played fewer than eighteen. */
export function courseLabel(r: Round): string {
  const parts = [r.course?.trim() || 'Course not named'];
  const nines = [r.firstNine, r.secondNine].filter(Boolean).join('/');
  if (nines) parts.push(`(${nines})`);
  const played = holesPlayed(r);
  if (played && played < 18) parts.push(`(${played})`);
  return parts.join(' ');
}

/** Every course layout played, with the numbers put on an eighteen-hole footing. */
export function byCourse(rounds: Round[], baseline: [number, number][]): CourseSplit[] {
  const groups = new Map<string, Round[]>();
  for (const r of rounds) {
    const nines = [r.firstNine, r.secondNine].filter(Boolean).join('/');
    const key = `${courseKey(r.course ?? '')}|${nines}|${holesPlayed(r)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return [...groups.entries()]
    .map(([, rs]) => {
      // the fullest spelling of the name wins the label
      const best = rs.reduce((a, b) => ((b.course ?? '').length > (a.course ?? '').length ? b : a));
      const label = courseLabel(best);
      const n = rs.length;
      // Each round carries its own scale, so a group holding both a full eighteen and a
      // walk-in after nine still averages to an eighteen-hole number.
      const scaled = rs.map((r) => ({ s: roundStats(r, baseline), k: roundScale(r) }));
      const per = (pick: (x: (typeof scaled)[number]) => number) =>
        scaled.reduce((sum, x) => sum + pick(x), 0) / n;
      const lastPlayed = rs.reduce((a, b) => (b.date > a.date ? b : a)).date;
      return {
        label,
        lastPlayed,
        rounds: n,
        putts: per((x) => x.s.totalPutts * x.k),
        threePlus: per((x) => x.s.threePlus * x.k),
        sg: per((x) => x.s.sg * x.k),
      };
    })
    // most played first, then most recent, so a hundred one-off courses do not crowd out
    // the ones you actually have data on
    .sort((a, b) => b.rounds - a.rounds || b.lastPlayed.localeCompare(a.lastPlayed));
}

export function allPutts(rounds: Round[]): Putt[] {
  return rounds.flatMap((r) => r.holes.flatMap((h) => h.putts));
}

/** Below this many sided misses the split is noise, not a lean. */
export const MIN_SIDED_MISSES = 8;
/**
 * Putts from one round are not independent: same greens, same day, same speed. A genuine
 * tendency has to show up across rounds, so a call needs breadth as well as volume.
 */
export const MIN_TAGGED_ROUNDS = 5;

export interface ReadBias {
  high: number;
  low: number;
  online: number;
  side: 'high' | 'low' | null;
  /** Share of sided misses that went to the leading side, 0.5 to 1. */
  lean: number;
  /** How far off an even split, in standard errors. Two is the line. */
  z: number;
  verdict: 'thin' | 'leaning' | 'read' | 'stroke';
  onlineShare: number | null;
  /** How many separate rounds the tags came from. */
  rounds: number;
}

/**
 * Misses piled on one side of the hole are a read, misses scattered both ways are a stroke.
 * Different problem, different practice, so the split is worth calling rather than just counting.
 */
export function readBias(p: Pattern, taggedRounds = 1): ReadBias {
  const sided = p.high + p.low;
  const misses = sided + p.online;
  const lean = sided ? Math.max(p.high, p.low) / sided : 0.5;
  const z = sided ? (2 * lean - 1) * Math.sqrt(sided) : 0;
  return {
    high: p.high,
    low: p.low,
    online: p.online,
    side: !sided || p.high === p.low ? null : p.high > p.low ? 'high' : 'low',
    lean,
    z,
    verdict:
      sided < MIN_SIDED_MISSES
        ? 'thin'
        : z < 2
          ? 'stroke'
          : taggedRounds < MIN_TAGGED_ROUNDS
            ? 'leaning'
            : 'read',
    rounds: taggedRounds,
    onlineShare: misses ? p.online / misses : null,
  };
}

export interface GreenSide {
  holes: number;
  putts: number;
  puttsPerHole: number;
  /** Median length of the first putt. Median, not mean, because one 60-footer skews it. */
  firstPutt: number;
  onePutts: number;
  onePuttPct: number;
  attempts: number;
  makes: number;
  /** Makes your own rates from these very distances predict. */
  expected: number;
  /** Actual minus expected. Positive is better than your own normal. */
  delta: number;
  /** Standard error on the delta, so noise can be called noise. */
  se: number;
}

export interface GreenSplit {
  hit: GreenSide;
  missed: GreenSide;
}

/**
 * Putting on holes where the green was hit against holes where it was missed.
 *
 * A tour baseline would poison this: missing a green leaves you short putts, and anyone who
 * putts worse than tour from short range looks like they crumble under scramble pressure when
 * they only ever had a short-putt problem. So each side is measured against your own make rate
 * from the same distances, which cancels that out and leaves only the difference between the
 * two situations.
 */
export function splitByGreen(rounds: Round[]): GreenSplit | null {
  const hit: Hole[] = [];
  const missed: Hole[] = [];

  for (const r of rounds) {
    for (const h of r.holes) {
      if (!h.putts.length) continue;
      const vsPar = holeVsPar(h);
      if (vsPar === undefined) continue;
      (h.putts.length - vsPar >= 2 ? hit : missed).push(h);
    }
  }
  if (!hit.length || !missed.length) return null;

  const rate = ownRates([...hit, ...missed]);
  return { hit: greenSide(hit, rate), missed: greenSide(missed, rate) };
}

function ownRates(holes: Hole[]): Record<BucketKey, number | null> {
  const made = emptyBuckets();
  for (const h of holes) {
    for (const p of h.putts) {
      const b = bucketOf(p.d);
      made[b].attempts++;
      if (p.made) made[b].makes++;
    }
  }
  const out = {} as Record<BucketKey, number | null>;
  for (const b of BUCKETS) {
    const t = made[b.key];
    out[b.key] = t.attempts ? t.makes / t.attempts : null;
  }
  return out;
}

function greenSide(holes: Hole[], rate: Record<BucketKey, number | null>): GreenSide {
  const firsts = holes.map((h) => h.putts[0].d).sort((a, b) => a - b);
  let putts = 0;
  let onePutts = 0;
  let attempts = 0;
  let makes = 0;
  let expected = 0;
  let variance = 0;

  for (const h of holes) {
    putts += h.putts.length;
    if (h.putts.length === 1) onePutts++;
    for (const p of h.putts) {
      const r = rate[bucketOf(p.d)];
      if (r === null) continue;
      attempts++;
      if (p.made) makes++;
      expected += r;
      variance += r * (1 - r);
    }
  }

  return {
    holes: holes.length,
    putts,
    puttsPerHole: putts / holes.length,
    firstPutt: firsts[Math.floor(firsts.length / 2)],
    onePutts,
    onePuttPct: (onePutts / holes.length) * 100,
    attempts,
    makes,
    expected,
    delta: makes - expected,
    se: Math.sqrt(variance),
  };
}

/**
 * A putt rolls toward the hole, so it cannot finish farther away than it started. When it does,
 * the distance was mistyped or an import read the wrong number, and every stat downstream of it
 * is wrong. Surfaced rather than silently corrected, because only the player knows the real one.
 */
export function suspectHoles(round: Round): { hole: number; from: number; to: number }[] {
  const out: { hole: number; from: number; to: number }[] = [];
  for (const h of round.holes) {
    for (let i = 0; i < h.putts.length - 1; i++) {
      const from = h.putts[i].d;
      const to = h.putts[i + 1].d;
      // Missing a tap-in and still having a tap-in is ordinary. Anything longer that fails to
      // get closer is not, so equal distances count too.
      if (to >= from && to > 2) out.push({ hole: h.hole, from, to });
    }
  }
  return out;
}
