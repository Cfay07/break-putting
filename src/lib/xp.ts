import { expectedPutts } from './sg';
import { makeability, type MakeModel } from './makeability';
import { breakBucket, breakDirsOf, type Putt } from './types';

/**
 * Expected putts to hole out, reading break and slope rather than distance alone.
 *
 * Strokes gained is already built on an expected-putts table: `expectedPutts(d) - putts`. This is
 * that table with the shape of the putt in it, so the whole thing is an upgrade to the baseline
 * rather than a second number competing with strokes gained.
 *
 * Conditions deliberately stay out. Green speed, bumpiness and aeration are one self-reported tag
 * for eighteen holes, so they would shift every putt in a round by the same amount and change
 * nothing you can learn inside it, while handing the person being measured a dial that lowers
 * their own bar. Break is per putt and checkable against what the ball did.
 */

/** Severity of the break, from what it actually did. Never from the read, which may be wrong. */
export function severityOf(p: Putt): number | undefined {
  const bucket = breakBucket(breakDirsOf(p));
  if (bucket !== 'lr' && bucket !== 'rl' && bucket !== 'double') return undefined;
  const sev = p.brokeAs ?? p.readAs;
  return sev && sev > 0 ? sev : undefined;
}

/**
 * Chance this putt drops, 0 to 1. The companion xP needs: 1.45 expected putts says nothing about
 * whether it goes in, the way an xG of 0.03 says three percent on its face. Same model, same
 * inputs, different question.
 *
 * Shown whole, never to a decimal. The fit's standard error on a single putt runs several points
 * wide, so a tenth of a percent would be decoration.
 */
export function makeChanceOf(model: MakeModel, p: Putt): number | null {
  return makeability(model, p.d, breakDirsOf(p), severityOf(p));
}

/**
 * Expected putts for one putt, or null when the model cannot speak yet.
 *
 * Built as the baseline **plus** the make chance the shape costs you, rather than rebuilt from
 * scratch. A from-scratch version needs its own excess-putts term, and an independently fitted
 * make model and a hand-written baseline table are not guaranteed to agree, so that term can come
 * out negative and quietly drag xP below what the make chance alone supports. The "no shape means
 * no change" test caught exactly that.
 *
 * This form makes the identity hold by construction. With nothing tagged the two make chances are
 * the same number, the adjustment is exactly zero, xP is the baseline, and strokes gained is
 * untouched on every putt you did not tag.
 *
 * The approximation it carries, stated rather than hidden: a lost make is charged as one extra
 * putt, so break moves the make chance but never the three-putt risk, which stays distance-only
 * inside the baseline. A severe downhill forty footer probably is more three-puttable than a flat
 * one and this does not know that.
 */
export function xpOf(model: MakeModel, baseline: [number, number][], p: Putt): number | null {
  const shaped = makeability(model, p.d, breakDirsOf(p), severityOf(p));
  const plain = makeability(model, p.d, []);
  if (shaped === null || plain === null) return null;
  // One putt is the floor: you cannot finish in fewer than the stroke you are about to play.
  return Math.max(1, expectedPutts(baseline, p.d) + (plain - shaped));
}

/**
 * How much harder the shape of this putt makes it than its distance alone says.
 *
 * Never called break credit. That name reads as the app deciding the break was to blame for a
 * miss, and it decides nothing of the sort: conditions set the expectation, execution tags record
 * what you did, and neither establishes why the ball stayed out.
 */
export function difficultyOf(
  model: MakeModel,
  baseline: [number, number][],
  p: Putt,
): number | null {
  const x = xpOf(model, baseline, p);
  return x === null ? null : x - expectedPutts(baseline, p.d);
}

/**
 * The per-putt difficulty adjustments on one hole.
 *
 * Not each putt's own adjustment. The leftover putt's difficulty already sits inside the previous
 * putt's expectation, so summing them raw charges it twice: on a hole with two breaking putts that
 * came to +0.325 against a true +0.084. The telescoping form `c_i - c_(i+1)` sums to `c_1`, which
 * is the hole's whole adjustment, and it is why a lag is now charged for leaving a breaking putt
 * rather than a straight one.
 */
export function holeAdjustments(
  model: MakeModel,
  baseline: [number, number][],
  putts: Putt[],
): (number | null)[] {
  const cs = putts.map((p) => difficultyOf(model, baseline, p));
  return cs.map((c, i) => {
    if (c === null) return null;
    const next = i + 1 < cs.length ? cs[i + 1] : 0; // nothing is left once it is holed
    return next === null ? null : c - next;
  });
}

/** Strokes gained on one putt against the condition-aware baseline, telescoping to the hole. */
export function puttSGAdjusted(
  model: MakeModel,
  baseline: [number, number][],
  putts: Putt[],
  i: number,
): number | null {
  const here = xpOf(model, baseline, putts[i]);
  if (here === null) return null;
  if (i + 1 >= putts.length) return here - 1;
  const next = xpOf(model, baseline, putts[i + 1]);
  return next === null ? null : here - 1 - next;
}

/** How a putt finished against what it was worth. */
export type Verdict = 'bailed' | 'robbed' | 'sold';

export const VERDICT_LABEL: Record<Verdict, string> = {
  bailed: 'Bailed',
  robbed: 'Robbed',
  sold: 'Sold',
};

export const VERDICT_SAYS: Record<Verdict, string> = {
  bailed: 'owed nothing, got it anyway',
  robbed: 'nothing wrong with it',
  sold: 'gave that one away',
};

/** Half a stroke. Below this a putt did roughly what it was worth and gets no label. */
const VERDICT_EDGE = 0.5;

/**
 * Bailed, Robbed or Sold, against xP rather than against distance.
 *
 * Robbed and Sold are both misses you should have made; the split is whether the stroke was
 * clean. That split is only available on a putt whose execution was actually looked at, so an
 * unreviewed miss gets no verdict at all rather than being quietly filed as Robbed. A lip-out
 * is the purest Robbed there is, and it still has to have been reviewed to say so.
 */
export function verdictOf(
  model: MakeModel,
  baseline: [number, number][],
  putts: Putt[],
  i: number,
): Verdict | null {
  const sg = puttSGAdjusted(model, baseline, putts, i);
  if (sg === null || Math.abs(sg) < VERDICT_EDGE) return null;
  if (sg > 0) return 'bailed';

  const p = putts[i];
  // Never infer a clean stroke from an empty set of faults.
  if (!p.executionAssessed) return null;
  const faulty =
    !!p.push || !!p.pull || !!p.decel || !!p.accel ||
    p.strike === 'toe' || p.strike === 'heel' ||
    !!p.wrongWay || (p.brokeAs !== undefined && p.brokeAs !== p.readAs);
  return faulty ? 'sold' : 'robbed';
}

/**
 * Round strokes gained against the condition-aware baseline.
 *
 * Same shape as the distance-only version in sg.ts: the first putt's expectation minus the putts
 * taken, summed over holes. Returns null until the break model is ready, so nothing pretends to
 * know more than it does.
 */
export function roundSGAdjusted(
  model: MakeModel,
  baseline: [number, number][],
  holes: { putts: Putt[] }[],
): number | null {
  if (!model.ready) return null;
  let sum = 0;
  for (const h of holes) {
    if (!h.putts.length) continue;
    const first = xpOf(model, baseline, h.putts[0]);
    if (first === null) return null;
    sum += first - h.putts.length;
  }
  return sum;
}
