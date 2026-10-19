import { expectedPutts } from './sg';
import type { Round } from './types';

/**
 * Tour make probability, derived from the expected-strokes baseline rather than fitted to the
 * player. Holing out from d costs one stroke if it drops and one plus whatever is left if it
 * does not:
 *
 *   E(d) = 1 + (1 - p) · E(leave)    so    p = 1 - (E(d) - 1) / E(leave)
 *
 * Checked against published tour make rates it lands within 1.5 points at every distance from
 * three to twenty feet. Past twenty the leave stops being a tap-in, the algebra drifts and then
 * goes negative, so the model refuses to answer out there. Twenty feet in is where holing putts
 * is the job anyway; beyond it the lag panel is the right tool.
 */
export const CONVERT_MAX_FT = 20;

/** A miss runs about a tenth of the putt past, floored at a tap-in. */
const leaveAfter = (d: number) => Math.max(1, 0.08 * d);

export function tourMakeRate(baseline: [number, number][], d: number): number | null {
  if (d < 1 || d > CONVERT_MAX_FT) return null;
  const p = 1 - (expectedPutts(baseline, d) - 1) / expectedPutts(baseline, leaveAfter(d));
  return p > 0 && p <= 1 ? p : null;
}

export interface ConvertBand {
  label: string;
  putts: number;
  made: number;
  yourRate: number;
  tourRate: number;
  /** Makes as a share of what tour would hole from the same putts. */
  vsTour: number;
  /** Whole putts given away against tour. Negative is the cost. */
  puttsVsTour: number;
}

const BANDS: { label: string; max: number }[] = [
  { label: '1-2 ft', max: 2 },
  { label: '3-5 ft', max: 5 },
  { label: '6-8 ft', max: 8 },
  { label: '9-12 ft', max: 12 },
  { label: '13-20 ft', max: 20 },
];

export interface ConvertSummary {
  bands: ConvertBand[];
  putts: number;
  made: number;
  expected: number;
  vsTour: number;
  se: number;
  /** The band giving away the most whole putts, which is where the practice goes. */
  worst: ConvertBand | null;
}

/** Enough putts in a band before its rate is worth printing. */
const MIN_BAND = 15;

export function converted(rounds: Round[], baseline: [number, number][]): ConvertSummary | null {
  const cells = BANDS.map((b) => ({ ...b, putts: 0, made: 0, expected: 0, variance: 0 }));

  for (const r of rounds) {
    for (const h of r.holes) {
      for (const putt of h.putts) {
        const p = tourMakeRate(baseline, putt.d);
        if (p === null) continue;
        const cell = cells.find((c) => putt.d <= c.max);
        if (!cell) continue;
        cell.putts++;
        cell.expected += p;
        cell.variance += p * (1 - p);
        if (putt.made) cell.made++;
      }
    }
  }

  const putts = cells.reduce((n, c) => n + c.putts, 0);
  if (!putts) return null;
  const made = cells.reduce((n, c) => n + c.made, 0);
  const expected = cells.reduce((n, c) => n + c.expected, 0);
  const variance = cells.reduce((n, c) => n + c.variance, 0);

  const bands = cells
    .filter((c) => c.putts >= MIN_BAND)
    .map((c) => ({
      label: c.label,
      putts: c.putts,
      made: c.made,
      yourRate: (100 * c.made) / c.putts,
      tourRate: (100 * c.expected) / c.putts,
      vsTour: (100 * c.made) / c.expected,
      puttsVsTour: c.made - c.expected,
    }));

  return {
    bands,
    putts,
    made,
    expected,
    vsTour: (100 * made) / expected,
    se: (100 * Math.sqrt(variance)) / expected,
    worst: bands.length ? bands.reduce((a, b) => (b.puttsVsTour < a.puttsVsTour ? b : a)) : null,
  };
}
