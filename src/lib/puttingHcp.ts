import { per18 } from './progress';
import type { Round } from './types';

/**
 * Strokes gained here is against tour. Broadie: a tour pro plays to about +6 and putts about one
 * stroke a round better than scratch, one putting stroke per six handicap strokes. Arccos has
 * 11-15 handicaps losing 1.99 a round putting to scratch, which lands on the same line.
 */
export const TOUR_HCP = -6;
export const HCP_PER_STROKE = 6;
export const HCP_ROUNDS = 10;
export const HCP_MIN_ROUNDS = 5;
const HIGH_CAP = 30;

const toHcp = (sg: number) => Math.max(TOUR_HCP, Math.min(HIGH_CAP, TOUR_HCP - sg * HCP_PER_STROKE));

export function hcpText(h: number): string {
  const n = Math.round(h);
  if (n >= HIGH_CAP) return `${HIGH_CAP}+`;
  return n < 0 ? `+${-n}` : String(n);
}

export interface PuttingHcp {
  hcp: number;
  /** Your rounds above your own average, averaged. Then the ones below. */
  good: number;
  bad: number;
  rounds: number;
  /** Every round counting, oldest first, so the first one is the next to drop out. */
  each: { id: string; date: string; hcp: number }[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Average of your last ten real rounds, turned into the handicap that putts like it. */
export function puttingHcp(rounds: Round[], baseline: [number, number][]): PuttingHcp | null {
  const real = rounds
    .filter((r) => r.finished && !r.practice && r.holes.some((h) => h.putts.length))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-HCP_ROUNDS);
  if (real.length < HCP_MIN_ROUNDS) return null;
  const sg = real.map((r) => per18(r, baseline));
  const avg = mean(sg);
  const above = sg.filter((v) => v >= avg);
  const below = sg.filter((v) => v < avg);
  return {
    hcp: toHcp(avg),
    good: toHcp(mean(above)),
    bad: toHcp(below.length ? mean(below) : avg),
    rounds: real.length,
    each: real.map((r, i) => ({ id: r.id, date: r.date, hcp: toHcp(sg[i]) })),
  };
}
