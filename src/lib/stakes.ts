import type { Round } from './types';

export interface StakesRow {
  label: string;
  vsPar: number;
  attempts: number;
  makes: number;
  /** 0 to 100, matching pct() elsewhere, so pctText can render it. */
  rate: number | null;
  avgFt: number;
}

export interface Stakes {
  rows: StakesRow[];
  /** Birdie tries against par saves, the only pair with enough putts to compare. */
  gap: { birdie: StakesRow; par: StakesRow; points: number; z: number } | null;
  band: { from: number; to: number };
}

/** A row needs this many first putts before its make rate is worth printing. */
export const MIN_ATTEMPTS = 20;

/**
 * The same putt is not the same putt. A six footer to save par and a six footer for birdie are
 * one number to every stat engine in golf, and they are not the same thing to the person over
 * the ball.
 *
 * Two things have to be held still or this measures neither. Distance, because putts for bogey
 * are usually comebacks and comebacks are short, which on its own produces a tidy fake trend.
 * And the putt number, because a second putt is rolled on a green you have already read. Only
 * first putts count here, inside one distance band.
 */
export function stakesOf(rounds: Round[], from = 5, to = 10): Stakes {
  const buckets = new Map<number, { attempts: number; makes: number; feet: number }>();

  for (const round of rounds) {
    if (!round.finished) continue;
    for (const hole of round.holes) {
      const { par, strokes } = hole;
      const first = hole.putts[0];
      if (par === undefined || strokes === undefined || !first) continue;
      if (first.d < from || first.d > to) continue;

      // What holing this putt would have written on the card.
      const vsPar = strokes - hole.putts.length + 1 - par;
      if (vsPar < -2 || vsPar > 1) continue;

      const b = buckets.get(vsPar) ?? { attempts: 0, makes: 0, feet: 0 };
      b.attempts++;
      b.feet += first.d;
      if (first.made) b.makes++;
      buckets.set(vsPar, b);
    }
  }

  const LABELS: Record<number, string> = {
    [-2]: 'For eagle',
    [-1]: 'For birdie',
    0: 'To save par',
    1: 'To save bogey',
  };
  const rows = [-2, -1, 0, 1]
    .map((vsPar) => {
      const b = buckets.get(vsPar);
      if (!b || !b.attempts) return null;
      return {
        label: LABELS[vsPar],
        vsPar,
        attempts: b.attempts,
        makes: b.makes,
        rate: b.attempts >= MIN_ATTEMPTS ? (b.makes / b.attempts) * 100 : null,
        avgFt: b.feet / b.attempts,
      };
    })
    .filter((r): r is StakesRow => r !== null);

  const birdie = rows.find((r) => r.vsPar === -1);
  const par = rows.find((r) => r.vsPar === 0);
  let gap: Stakes['gap'] = null;
  if (birdie?.rate != null && par?.rate != null) {
    // The test wants proportions, not the 0 to 100 the rows carry for display.
    const pb = birdie.makes / birdie.attempts;
    const pp = par.makes / par.attempts;
    const pooled = (birdie.makes + par.makes) / (birdie.attempts + par.attempts);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / birdie.attempts + 1 / par.attempts));
    gap = { birdie, par, points: Math.round((pp - pb) * 100), z: se ? (pp - pb) / se : 0 };
  }

  return { rows, gap, band: { from, to } };
}
