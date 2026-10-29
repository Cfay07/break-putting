import { formOf } from './form';
import type { Round } from './types';

export interface FormTrial {
  /** Rounds whose process layer actually unlocked. */
  judged: number;
  needed: number;
  r: number | null;
  /** Rounds whose position changes when you rank by Form instead of strokes gained. */
  moved: number;
  verdict: 'waiting' | 'keep' | 'retire' | 'reweight';
}

/** Ten rounds carrying process before the correlation means anything. */
export const TRIAL_ROUNDS = 10;

function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 3) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : null;
}

/**
 * Form's standing trial, run on every load rather than remembered as a task.
 *
 * Form exists to disagree with strokes gained. If it ranks rounds in the same order, it is a
 * second name for a number already on the screen, which is what got expected makes deleted in
 * a0dfd64 at r = 0.905. The threshold was written down before the answer was known: under 0.90
 * it stays, over 0.95 it goes, between the two the 50/50 blend gets one attempt at reweighting.
 *
 * Only rounds whose process layer unlocked are in. An outcome-only Form is a function of strokes
 * gained by construction, so including those would be testing the arithmetic rather than the idea.
 */
export function formTrial(rounds: Round[], baseline: [number, number][]): FormTrial {
  const pairs: { form: number; sg: number }[] = [];
  for (const r of rounds) {
    if ((r as { deleted?: boolean }).deleted || !r.finished) continue;
    const f = formOf(r, baseline);
    if (!f || f.process === null) continue;
    pairs.push({ form: f.score, sg: f.sg18 });
  }
  const judged = pairs.length;
  if (judged < TRIAL_ROUNDS) {
    return { judged, needed: TRIAL_ROUNDS, r: null, moved: 0, verdict: 'waiting' };
  }

  const r = pearson(pairs.map((p) => p.form), pairs.map((p) => p.sg));
  const rank = (key: 'form' | 'sg') =>
    pairs
      .map((p, i) => ({ i, v: p[key] }))
      .sort((a, b) => b.v - a.v)
      .map((x) => x.i);
  const byForm = rank('form');
  const bySg = rank('sg');
  const moved = byForm.filter((idx, place) => bySg[place] !== idx).length;

  const verdict = r === null ? 'waiting' : r >= 0.95 ? 'retire' : r <= 0.9 ? 'keep' : 'reweight';
  return { judged, needed: TRIAL_ROUNDS, r, moved, verdict };
}
