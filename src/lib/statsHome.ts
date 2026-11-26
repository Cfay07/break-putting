import { bleedSummary } from './bleed';
import { formOf } from './form';
import { readError } from './readError';
import { puttSG } from './sg';
import { byStrike, lagSaves, missAnatomy, overall, roundScale, roundStats } from './stats';
import type { FocusBand } from './starters';
import { breakDirsOf, type Round } from './types';

/** Which fifteen-minute session works on a distance band. */
export const BAND_FOCUS: Record<string, FocusBand> = {
  tapin: 'short',
  b35: 'short',
  b68: 'mid',
  b915: 'makeable',
  b1630: 'lag',
  b3140: 'lag',
  b4150: 'long',
  b5160: 'long',
  b61: 'long',
};

/** The ranges the score card splits into. Past 40 feet is one piece: none of it moves a score much. */
const PIECES: { key: string; label: string; buckets: string[]; lo: number; hi: number }[] = [
  { key: 'tapin', label: 'Tap-ins', buckets: ['tapin'], lo: 0, hi: 2 },
  { key: 'b35', label: '3 to 5 ft', buckets: ['b35'], lo: 3, hi: 5 },
  { key: 'b68', label: '6 to 8 ft', buckets: ['b68'], lo: 6, hi: 8 },
  { key: 'b915', label: '9 to 15 ft', buckets: ['b915'], lo: 9, hi: 15 },
  { key: 'b1630', label: '16 to 30 ft', buckets: ['b1630'], lo: 16, hi: 30 },
  { key: 'b3140', label: '31 to 40 ft', buckets: ['b3140'], lo: 31, hi: 40 },
  { key: 'b41', label: '41+ ft', buckets: ['b4150', 'b5160', 'b61'], lo: 41, hi: Infinity },
];

export interface Piece {
  key: string;
  label: string;
  /** Strokes gained a round against tour; negative is what that range costs you. */
  sg: number;
  lo: number;
  hi: number;
}

export interface ShootSplit {
  shoot: number;
  withTour: number;
  rounds: number;
  pieces: Piece[];
}

/**
 * Your scoring average, the same rounds with tour putting, and the gap between them cut by where
 * each putt started. Built from the same scored rounds and the same scaling throughout, so the
 * pieces add up to the gap exactly.
 */
export function shootSplit(rounds: Round[], baseline: [number, number][]): ShootSplit | null {
  const scored = rounds.filter((r) => r.score !== undefined && !r.practice);
  if (!scored.length) return null;
  const k = (r: Round) => roundScale(r);
  const shoot = scored.reduce((a, r) => a + r.score! * k(r), 0) / scored.length;
  const withTour = scored.reduce((a, r) => a + (r.score! + roundStats(r, baseline).sg) * k(r), 0) / scored.length;
  const per = overall(scored, baseline).bucketSgPerRound;
  const pieces = PIECES.map((p) => ({
    key: p.key,
    label: p.label,
    lo: p.lo,
    hi: p.hi,
    sg: p.buckets.reduce((a, b) => a + (per[b as keyof typeof per] ?? 0), 0),
  }));
  return { shoot, withTour, rounds: scored.length, pieces };
}

/** Putts needed on one side of a break before it can be named as the costly one. */
const WITHIN_MIN = 12;

export interface Within {
  label: string;
  perPutt: number;
  putts: number;
}

/**
 * Inside one range, the break that costs you most, when it holds up: enough putts, losing strokes,
 * and clearly worse than the range as a whole. Null otherwise, so the line never guesses.
 */
export function withinRange(rounds: Round[], baseline: [number, number][], piece: Piece): Within | null {
  const sides: Record<string, { label: string; n: number; sg: number }> = {
    lr: { label: 'left-to-right putts', n: 0, sg: 0 },
    rl: { label: 'right-to-left putts', n: 0, sg: 0 },
    straight: { label: 'straight putts', n: 0, sg: 0 },
  };
  let all = 0;
  let allSg = 0;
  for (const r of rounds)
    for (const h of r.holes)
      h.putts.forEach((p, i) => {
        if (p.d < piece.lo || p.d > piece.hi) return;
        const sg = puttSG(baseline, p.d, p.made, i + 1 < h.putts.length ? h.putts[i + 1].d : null);
        if (sg === null || sg === undefined) return;
        all++;
        allSg += sg;
        const dirs = breakDirsOf(p);
        const lr = dirs.includes('L→R');
        const rl = dirs.includes('R→L');
        const side = lr && !rl ? 'lr' : rl && !lr ? 'rl' : dirs.includes('straight') ? 'straight' : null;
        if (!side) return;
        sides[side].n++;
        sides[side].sg += sg;
      });
  if (!all) return null;
  const rangeAvg = allSg / all;
  const worst = Object.values(sides)
    .filter((s) => s.n >= WITHIN_MIN)
    .map((s) => ({ label: s.label, perPutt: s.sg / s.n, putts: s.n }))
    .filter((s) => s.perPutt < 0 && s.perPutt <= rangeAvg - 0.1)
    .sort((a, b) => a.perPutt - b.perPutt)[0];
  return worst ?? null;
}

/** Rounds before the last ten have to number this many before a trend is worth an arrow. */
const BEFORE_MIN = 5;
export const RECENT = 10;

export interface Split {
  recent: Round[];
  before: Round[];
}

/** Your last ten rounds and the ones before them, or null when there are too few to compare. */
export function recentSplit(rounds: Round[]): Split | null {
  const real = rounds.filter((r) => !r.practice).sort((a, b) => a.date.localeCompare(b.date));
  if (real.length < RECENT + BEFORE_MIN) return null;
  return { recent: real.slice(-RECENT), before: real.slice(0, -RECENT) };
}

/** A share, or null when there is nothing to take a share of. */
type Measure = (rs: Round[], baseline: [number, number][]) => { value: number; n: number } | null;

const ratio = (a: number, b: number) => (b ? { value: a / b, n: b } : null);

export const MEASURES: Record<string, Measure> = {
  short: (rs) => {
    const ps = rs.flatMap((r) => r.holes.flatMap((h) => h.putts)).filter((p) => p.d >= 3 && p.d <= 10);
    return ratio(ps.filter((p) => p.made).length, ps.length);
  },
  lag: (rs) => {
    const l = lagSaves(rs);
    return ratio(l.good, l.lags);
  },
  bleed: (rs) => {
    const b = bleedSummary(rs);
    return b.shotsPerRound === null ? null : { value: b.shotsPerRound, n: b.rounds };
  },
  reads: (rs) => {
    const r = readError(rs);
    return ratio(r.hadIt, r.judged);
  },
  misses: (rs) => {
    const m = missAnatomy(rs);
    return ratio(m.lineWrong, m.judged);
  },
  form: (rs, baseline) => {
    const fs = rs.map((r) => formOf(r, baseline)).filter((f) => f !== null);
    return fs.length ? { value: fs.reduce((a, f) => a + f.score, 0) / fs.length, n: fs.length } : null;
  },
  sg: (rs, baseline) => {
    const o = overall(rs, baseline);
    return o.sgPerRound === null ? null : { value: o.sgPerRound, n: o.rounds };
  },
  strike: (rs) => {
    const s = byStrike(rs);
    const total = s.reduce((n, r) => n + r.putts, 0);
    return ratio(s.find((r) => r.key === 'centre')?.putts ?? 0, total);
  },
};

export interface RowNumber {
  /** The number shown: your last ten rounds when there is a comparison, otherwise every round. */
  now: number;
  /** The rounds before the last ten, or null for no arrow. */
  before: number | null;
  /** Tagged only lately: there is a number now but nothing before to compare it with. */
  fresh: boolean;
}

export function rowNumber(
  key: string,
  rounds: Round[],
  split: Split | null,
  baseline: [number, number][],
): RowNumber | null {
  const m = MEASURES[key];
  if (!split) {
    const all = m(rounds, baseline);
    return all ? { now: all.value, before: null, fresh: false } : null;
  }
  const now = m(split.recent, baseline);
  if (!now) return null;
  const before = m(split.before, baseline);
  return { now: now.value, before: before ? before.value : null, fresh: !before };
}
