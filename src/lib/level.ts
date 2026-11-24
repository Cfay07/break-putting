import type { Round } from './types';

/**
 * Two distances that place a putter against golfers at every level, measured rather than modelled:
 * how far out you still one-putt half the time, and how far out you average exactly two putts.
 *
 * Source: Broadie, "Assessing golfer performance using Golfmetrics", Science and Golf V (2008),
 * Table 1. Groups are by scoring average. Two published points per group is all the paper gives,
 * so the app compares on these two numbers and never stretches them into a full table.
 */
export const LEVELS = [
  { label: 'Tour players', short: 'Tour', d50: 8.2, d2: 30 },
  { label: 'golfers who shoot 70 to 83', short: 'Shoot 70 to 83', d50: 5.8, d2: 25 },
  { label: 'golfers who shoot 84 to 97', short: 'Shoot 84 to 97', d50: 5.1, d2: 19 },
  { label: 'golfers who shoot 97 to 120', short: 'Shoot 97 to 120', d50: 3.8, d2: 12 },
];

/** First putts needed before the half-way distance is worth quoting. */
export const MIN_FIRST_PUTTS = 100;
/** First putts from 15 ft and out needed before the two-putt distance is. */
const MIN_LONG = 30;

export interface Level {
  /** One-putt half the time from here. */
  d50: number;
  /** Average two putts from here, or null when there are too few long putts to place it. */
  d2: number | null;
  firstPutts: number;
}

/** The first putt on every holed-out hole, with how many putts the hole took. */
function firstPutts(rounds: Round[]): { x: number; made: number; putts: number; d: number }[] {
  return rounds
    .filter((r) => r.finished && !r.practice)
    .flatMap((r) => r.holes)
    .filter((h) => h.putts.length > 0 && h.putts[h.putts.length - 1].made && h.putts[0].d >= 1)
    .map((h) => ({ d: h.putts[0].d, x: Math.log(h.putts[0].d), made: h.putts[0].made ? 1 : 0, putts: h.putts.length }));
}

export function levelOf(rounds: Round[]): Level | null {
  const ps = firstPutts(rounds);
  if (ps.length < MIN_FIRST_PUTTS) return null;

  // Make chance as a logistic in log distance, fitted by Newton's method.
  let a = 0;
  let b = 0;
  for (let i = 0; i < 50; i++) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (const p of ps) {
      const q = 1 / (1 + Math.exp(-(a + b * p.x)));
      const w = q * (1 - q);
      g0 += p.made - q;
      g1 += (p.made - q) * p.x;
      h00 += w;
      h01 += w * p.x;
      h11 += w * p.x * p.x;
    }
    const det = h00 * h11 - h01 * h01;
    if (!det) return null;
    a += (h11 * g0 - h01 * g1) / det;
    b += (h00 * g1 - h01 * g0) / det;
  }
  if (b >= 0) return null;
  const d50 = Math.exp(-a / b);

  // Putts to hole out, straight line in log distance, read where it crosses two.
  let d2: number | null = null;
  const long = ps.filter((p) => p.d >= 15).length;
  if (long >= MIN_LONG) {
    const mx = ps.reduce((s, p) => s + p.x, 0) / ps.length;
    const my = ps.reduce((s, p) => s + p.putts, 0) / ps.length;
    let sxy = 0;
    let sxx = 0;
    for (const p of ps) {
      sxy += (p.x - mx) * (p.putts - my);
      sxx += (p.x - mx) ** 2;
    }
    const slope = sxy / sxx;
    if (slope > 0) {
      const at = Math.exp(mx + (2 - my) / slope);
      // Only inside the putts you have actually hit: past them the line is a guess.
      if (at <= Math.max(...ps.map((p) => p.d))) d2 = at;
    }
  }
  return { d50, d2, firstPutts: ps.length };
}

/** Where a distance sits among the groups: better than all, between two, or below all. */
export function placeAmong(value: number, key: 'd50' | 'd2'): string {
  const sorted = [...LEVELS].sort((x, y) => y[key] - x[key]);
  const name = (i: number) => (i === 0 ? 'tour players' : sorted[i].label);
  if (value >= sorted[0][key]) return `at or past ${name(0)}`;
  for (let i = 1; i < sorted.length; i++)
    if (value >= sorted[i][key])
      return `between ${name(i - 1)} and ${name(i).replace(/^golfers who shoot /, i > 1 ? '' : 'golfers who shoot ')}`;
  return `short of ${name(sorted.length - 1)}`;
}

export function levelStory(l: Level): string {
  const range = `Your range is ${l.d50.toFixed(1)} ft, the length you still hole half the time`;
  const a = placeAmong(l.d50, 'd50');
  if (l.d2 === null) return `${range}, ${a}.`;
  const b = placeAmong(l.d2, 'd2');
  const two = `You average two putts from ${Math.round(l.d2)} ft`;
  return a === b ? `${range}. ${two}. Both sit ${a}.` : `${range}, ${a}. ${two}, ${b}.`;
}
