import { expectedPutts } from './sg';
import { irls, makeability, type MakeModel } from './makeability';
import {
  breakBucket,
  breakDirsOf,
  CUP_ENTRIES,
  CUP_LABELS,
  type CupEntry,
  type Putt,
} from './types';

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
  return faultyOf(p) ? 'sold' : 'robbed';
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

type AnyRound = {
  id: string;
  label: string;
  date: string;
  deleted?: boolean;
  holes: { hole: number; putts: Putt[] }[];
};

export interface CupUse {
  /** Holed putts carrying an entry point you actually saw. */
  n: number;
  /** Holed putts where you said you did not see it drop. */
  unsure: number;
  /** Straight through the front, the centre cut. */
  centre: number;
  /** Came in off a side or round the back. */
  edge: number;
  byPoint: { point: CupEntry; label: string; n: number }[];
}

/**
 * How much of the hole you are using.
 *
 * A make is a make to every putting stat there is, so a centre cut and a ball that fell in off
 * the back lip have identical records. They are not identical strokes, and a run of edge-entry
 * makes is the kind of thing that stops happening. Counting, no model: this is an observation
 * you made, not a number anything inferred.
 *
 * It says nothing about pace or about whether the read was right. Entry point is a joint result
 * of line, speed and break together, so a back door can come from too much pace or from a putt
 * that took the break late, and this cannot tell those apart.
 */
export function cupUse(rounds: AnyRound[]): CupUse {
  const counts = new Map<CupEntry, number>();
  let n = 0;
  let unsure = 0;
  for (const r of rounds) {
    if (r.deleted) continue;
    for (const h of r.holes) {
      for (const p of h.putts) {
        if (!p.made || !p.cupEntry) continue;
        if (p.cupEntry === 'unsure') {
          unsure++;
          continue;
        }
        n++;
        counts.set(p.cupEntry, (counts.get(p.cupEntry) ?? 0) + 1);
      }
    }
  }
  const centre = counts.get('front') ?? 0;
  return {
    n,
    unsure,
    centre,
    edge: n - centre,
    byPoint: CUP_ENTRIES.map((point) => ({
      point,
      label: CUP_LABELS[point],
      n: counts.get(point) ?? 0,
    })).sort((a, b) => b.n - a.n),
  };
}

export interface ExecModel {
  /**
   * Recalibration for the execution layer. Stages one and two are fitted across every putt,
   * good strokes and bad mixed together, so an explicitly clean stroke would otherwise inherit
   * the all-strokes average and read too low. This is the intercept that fixes that.
   */
  alpha: number;
  /** Log-odds carried by a putt with a recorded fault. Not constrained to be negative. */
  beta: number;
  nClean: number;
  nFaulty: number;
  cleanRate: number | null;
  faultyRate: number | null;
  /** Clean make rate minus faulty, in points. */
  gap: number | null;
  /** Half-width of the 95% interval on that gap. */
  band: number | null;
  /** True only where the gap clears its own interval. */
  predictive: boolean;
  estimable: boolean;
  /** Faults were only ever recorded on misses, so the variable is standing in for the outcome. */
  confounded: boolean;
  faultyMakes: number;
  cleanMisses: number;
}

const EMPTY_EXEC: ExecModel = {
  alpha: 0, beta: 0, nClean: 0, nFaulty: 0, cleanRate: null, faultyRate: null,
  gap: null, band: null, predictive: false, estimable: false,
  confounded: false, faultyMakes: 0, cleanMisses: 0,
};

/** A fault anyone actually recorded. Absence is not evidence of a clean stroke. */
export function faultyOf(p: Putt): boolean {
  return (
    !!p.push || !!p.pull || !!p.decel || !!p.accel || !!p.wrongWay ||
    p.strike === 'toe' || p.strike === 'heel' ||
    // A read that did not match what the putt did is a fault, holed or not. verdictOf has always
    // counted it; this did not, so a misread putt that dropped was faulty for the label and clean
    // for the model, which is exactly the case the execution layer most needs to see.
    (p.brokeAs !== undefined && p.brokeAs !== p.readAs)
  );
}

/**
 * Whether the stroke was looked at.
 *
 * `executionAssessed` is the honest flag and only exists on putts logged since it shipped. A
 * strike tag counts too, because picking "middle" is an explicit judgement that the strike was
 * fine, not a blank. An untouched putt is neither clean nor faulty, it is unknown, and it stays
 * out of the fit entirely.
 */
export function assessedOf(p: Putt): boolean {
  return !!p.executionAssessed || p.strike !== undefined;
}

/**
 * Does your stroke tagging predict anything?
 *
 * The honest form of xPOT. Fitted only on putts whose stroke was actually judged, as
 * `logit(p) = logit(p_conditions) + alpha + beta * fault`, with the conditions prediction as a
 * fixed offset so this layer cannot re-estimate difficulty.
 *
 * `beta` is deliberately unconstrained. Forcing it negative and then presenting the result as a
 * finding would be deciding the answer in advance; if your tags turn out not to predict misses,
 * the number should be allowed to say so.
 */
export function fitExecModel(model: MakeModel, rounds: AnyRound[]): ExecModel {
  const rows: { p: Putt; fault: boolean; made: boolean }[] = [];
  for (const r of rounds) {
    if (r.deleted) continue;
    for (const h of r.holes) {
      for (const p of h.putts) {
        if (!assessedOf(p)) continue;
        rows.push({ p, fault: faultyOf(p), made: p.made });
      }
    }
  }
  const clean = rows.filter((r) => !r.fault);
  const faulty = rows.filter((r) => r.fault);
  if (clean.length < 5 || faulty.length < 5) {
    return { ...EMPTY_EXEC, nClean: clean.length, nFaulty: faulty.length };
  }
  // A faulty group with almost no makes in it is not a stroke measurement. It happens when
  // faults are only ever recorded on putts that missed, and then "has a fault" is standing in
  // for "missed" and the fit is reading the tagging rule rather than the stroke. Refuse rather
  // than report a gap that is really the outcome in disguise.
  const faultyMakes = faulty.filter((r) => r.made).length;
  const cleanMisses = clean.filter((r) => !r.made).length;
  if (faultyMakes < 5 || cleanMisses < 5) {
    return {
      ...EMPTY_EXEC,
      nClean: clean.length,
      nFaulty: faulty.length,
      confounded: true,
      faultyMakes,
      cleanMisses,
    };
  }

  const rate = (xs: typeof rows) => xs.filter((x) => x.made).length / xs.length;
  const cleanRate = rate(clean);
  const faultyRate = rate(faulty);
  const gap = cleanRate - faultyRate;
  const band =
    1.96 *
    Math.sqrt(
      (cleanRate * (1 - cleanRate)) / clean.length +
        (faultyRate * (1 - faultyRate)) / faulty.length,
    );

  const offset = rows.map((r) => {
    const chance = makeChanceOf(model, r.p);
    const safe = Math.min(Math.max(chance ?? 0.5, 1e-4), 1 - 1e-4);
    return Math.log(safe / (1 - safe));
  });
  const fit = irls(
    rows.map((r) => [1, r.fault ? 1 : 0]),
    rows.map((r) => (r.made ? 1 : 0)),
    [0, 0.5],
    offset,
  );

  return {
    alpha: fit ? fit[0] : 0,
    beta: fit ? fit[1] : 0,
    nClean: clean.length,
    nFaulty: faulty.length,
    cleanRate, faultyRate, gap, band,
    predictive: band < Math.abs(gap),
    estimable: !!fit,
    confounded: false,
    faultyMakes,
    cleanMisses,
  };
}

/**
 * Expected putts given how the stroke actually came out.
 *
 * Only speaks on a putt whose stroke was judged, and only where the gap has cleared its own
 * interval. Until then the tags have not been shown to predict anything and a number here would
 * be dressing up noise.
 */
export function xpotOf(
  model: MakeModel,
  exec: ExecModel,
  baseline: [number, number][],
  p: Putt,
): number | null {
  if (!exec.estimable || !exec.predictive || !assessedOf(p)) return null;
  const chance = makeChanceOf(model, p);
  if (chance === null) return null;
  const safe = Math.min(Math.max(chance, 1e-4), 1 - 1e-4);
  const eta = Math.log(safe / (1 - safe)) + exec.alpha + (faultyOf(p) ? exec.beta : 0);
  const after = 1 / (1 + Math.exp(-eta));
  return Math.max(1, expectedPutts(baseline, p.d) + (chance - after));
}

/** What the stroke cost, in putts. Null wherever xPOT cannot speak. */
export function strokeCostOf(
  model: MakeModel,
  exec: ExecModel,
  baseline: [number, number][],
  p: Putt,
): number | null {
  const after = xpotOf(model, exec, baseline, p);
  const before = xpOf(model, baseline, p);
  return after === null || before === null ? null : after - before;
}

export interface XpSpread {
  /** Buckets across the xP range, each holding how many putts landed in it. */
  bins: { from: number; to: number; n: number }[];
  n: number;
  median: number | null;
  hardest: number | null;
  /** Putts at or past the two-putt mark. */
  pastTwo: number;
}

/**
 * The spread of what you have actually stood over.
 *
 * One putt is the floor and two is the mark where holing it and three-putting it are equally
 * likely, so those two anchors give the scale a meaning without anyone having to learn a new
 * unit. Only putts carrying a shape are in: the rest would pile up on the distance curve and
 * say nothing about break.
 */
export function xpSpread(
  model: MakeModel,
  baseline: [number, number][],
  rounds: AnyRound[],
): XpSpread {
  const LO = 1.0;
  const HI = 2.3;
  const STEP = 0.1;
  const bins = Array.from({ length: Math.round((HI - LO) / STEP) }, (_, i) => ({
    from: +(LO + i * STEP).toFixed(2),
    to: +(LO + (i + 1) * STEP).toFixed(2),
    n: 0,
  }));
  const all: number[] = [];
  if (!model.ready) return { bins, n: 0, median: null, hardest: null, pastTwo: 0 };

  for (const r of rounds) {
    if (r.deleted) continue;
    for (const h of r.holes) {
      for (const p of h.putts) {
        if (!breakDirsOf(p).length) continue;
        const x = xpOf(model, baseline, p);
        if (x === null) continue;
        all.push(x);
        const i = Math.min(bins.length - 1, Math.max(0, Math.floor((x - LO) / STEP)));
        bins[i].n += 1;
      }
    }
  }
  all.sort((a, b) => a - b);
  return {
    bins,
    n: all.length,
    median: all.length ? all[Math.floor(all.length / 2)] : null,
    hardest: all.length ? all[all.length - 1] : null,
    pastTwo: all.filter((x) => x >= 2).length,
  };
}
