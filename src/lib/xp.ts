import { expectedPutts } from './sg';
import { irls, makeability, type MakeModel } from './makeability';
import { breakBucket, breakDirsOf, slopeOf, type Putt } from './types';

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

/** How much it ran uphill or down, where one was picked. */
export function slopeAmountOf(p: Putt): number | undefined {
  if (!slopeOf(breakDirsOf(p))) return undefined;
  return p.slopeAs && p.slopeAs > 0 ? p.slopeAs : undefined;
}

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
  // Beyond anything that has been hit, the curve still answers and the answer means nothing.
  if (model.longest && p.d > model.longest) return null;
  return makeability(model, p.d, breakDirsOf(p), severityOf(p), slopeAmountOf(p));
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
  const shaped = makeability(model, p.d, breakDirsOf(p), severityOf(p), slopeAmountOf(p));
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
export function difficultyOf(model: MakeModel, baseline: [number, number][], p: Putt): number | null {
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
export function holeAdjustments(model: MakeModel, baseline: [number, number][], putts: Putt[]): (number | null)[] {
  const cs = putts.map((p) => difficultyOf(model, baseline, p));
  return cs.map((c, i) => {
    if (c === null) return null;
    const next = i + 1 < cs.length ? cs[i + 1] : 0; // nothing is left once it is holed
    return next === null ? null : c - next;
  });
}

type AnyRound = {
  id: string;
  label: string;
  date: string;
  deleted?: boolean;
  holes: { hole: number; putts: Putt[] }[];
};

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
  alpha: 0,
  beta: 0,
  nClean: 0,
  nFaulty: 0,
  cleanRate: null,
  faultyRate: null,
  gap: null,
  band: null,
  predictive: false,
  estimable: false,
  confounded: false,
  faultyMakes: 0,
  cleanMisses: 0,
};

/** A fault anyone actually recorded. Absence is not evidence of a clean stroke. */
export function faultyOf(p: Putt): boolean {
  return (
    !!p.push ||
    !!p.pull ||
    !!p.decel ||
    !!p.accel ||
    !!p.wrongWay ||
    p.strike === 'toe' ||
    p.strike === 'heel' ||
    // A read that did not match what the putt did is a fault, holed or not. A misread putt that
    // dropped is exactly the case the execution layer most needs to see.
    (p.brokeAs !== undefined && p.brokeAs !== p.readAs)
  );
}

/**
 * Whether the stroke was looked at.
 *
 * Only the explicit flag counts. A strike tag used to count as well, on the reasoning that
 * picking "middle" is a judgement rather than a blank, and that was an over-claim: it judges the
 * strike and says nothing about whether the putt was also pushed or quit on. A putt that was only
 * ever looked at down one axis was landing in the clean pile as though the whole stroke had been
 * cleared.
 *
 * The cost is real. Every putt logged before the flag existed drops out of the fit, which leaves
 * the execution model with very little. That is the correct amount of very little.
 */
export function assessedOf(p: Putt): boolean {
  return !!p.executionAssessed;
}

/**
 * Does your stroke tagging predict anything?
 *
 * Fitted only on putts whose stroke was actually judged, as
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
    1.96 * Math.sqrt((cleanRate * (1 - cleanRate)) / clean.length + (faultyRate * (1 - faultyRate)) / faulty.length);

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
    cleanRate,
    faultyRate,
    gap,
    band,
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
export function xpotOf(model: MakeModel, exec: ExecModel, baseline: [number, number][], p: Putt): number | null {
  if (!exec.estimable || !exec.predictive || !assessedOf(p)) return null;
  const chance = makeChanceOf(model, p);
  if (chance === null) return null;
  const safe = Math.min(Math.max(chance, 1e-4), 1 - 1e-4);
  const eta = Math.log(safe / (1 - safe)) + exec.alpha + (faultyOf(p) ? exec.beta : 0);
  const after = 1 / (1 + Math.exp(-eta));
  return Math.max(1, expectedPutts(baseline, p.d) + (chance - after));
}

/** What the stroke cost, in putts. Null wherever the stroke layer cannot speak. */
export function strokeCostOf(model: MakeModel, exec: ExecModel, baseline: [number, number][], p: Putt): number | null {
  const after = xpotOf(model, exec, baseline, p);
  const before = xpOf(model, baseline, p);
  return after === null || before === null ? null : after - before;
}

export interface BeatSpread {
  bins: { from: number; to: number; n: number }[];
  n: number;
  beat: number;
  level: number;
  best: { sg: number; roundId: string; label: string; hole: number; ft: number } | null;
  worst: { sg: number; roundId: string; label: string; hole: number; ft: number } | null;
}

/**
 * How often you beat what the hole was worth, and by how much.
 *
 * This replaced a histogram of xP itself, which ranked putts in almost exactly the order their
 * length does: Spearman 0.99 against distance, with a By distance table sitting directly beneath
 * it. That chart measured what you faced, which you already knew. This measures what you did
 * with it.
 *
 * One bar per hole rather than per putt, because the expectation covers finishing the hole: a
 * twenty two footer already carries the putt it leaves you.
 */
export function beatSpread(baseline: [number, number][], rounds: AnyRound[]): BeatSpread {
  const LO = -2;
  const HI = 1;
  const STEP = 0.25;
  const bins = Array.from({ length: Math.round((HI - LO) / STEP) }, (_, i) => ({
    from: +(LO + i * STEP).toFixed(2),
    to: +(LO + (i + 1) * STEP).toFixed(2),
    n: 0,
  }));
  let beat = 0;
  let level = 0;
  let n = 0;
  let best: BeatSpread['best'] = null;
  let worst: BeatSpread['worst'] = null;

  for (const r of rounds) {
    if (r.deleted) continue;
    for (const h of r.holes) {
      if (!h.putts.length) continue;
      const sg = expectedPutts(baseline, h.putts[0].d) - h.putts.length;
      n += 1;
      if (sg > 0.005) beat += 1;
      else if (sg >= -0.005) level += 1;
      const where = { sg, roundId: r.id, label: r.label, hole: h.hole, ft: h.putts[0].d };
      if (!best || sg > best.sg) best = where;
      if (!worst || sg < worst.sg) worst = where;
      const i = Math.min(bins.length - 1, Math.max(0, Math.floor((sg - LO) / STEP)));
      bins[i].n += 1;
    }
  }
  return { bins, n, beat, level, best, worst };
}

export type XpotState = { ok: true; xpot: number; cost: number } | { ok: false; why: string };

/**
 * One answer to "what does the stroke layer say about this putt", used wherever it appears.
 *
 * Not called xPOT any more. The x-prefix works for xP, which is expected putts and additive and
 * used all over. "On target" is borrowed from xGOT, where it means a shot that hit the goal and
 * placement inside the frame matters. Putting has no equivalent, so the letters described
 * nothing. The label already read "After the stroke" in English, which is the whole of it.
 *
 * It used to be explained on the stats page and nowhere else, so the reason it was silent on a
 * putt card was a thing you had to go and find. Worse, the round row rendered an empty string in
 * the one case where it actually works. A number that refuses has to say why in the same place
 * it refuses, every time.
 */
export function xpotStatus(model: MakeModel, exec: ExecModel, baseline: [number, number][], p: Putt): XpotState {
  if (exec.confounded) {
    return {
      ok: false,
      why: `waiting on putts you struck badly and holed anyway (${exec.faultyMakes} so far, needs 5)`,
    };
  }
  if (!exec.estimable) {
    return { ok: false, why: `waiting on judged strokes (${exec.nClean + exec.nFaulty} so far)` };
  }
  if (!exec.predictive) {
    const gap = Math.round((exec.gap ?? 0) * 100);
    const band = Math.round((exec.band ?? 0) * 100);
    return { ok: false, why: `clean beats faulty by ${gap} pts, margin is ${band}, so not settled` };
  }
  if (!assessedOf(p)) return { ok: false, why: 'this stroke was never judged' };

  const xpot = xpotOf(model, exec, baseline, p);
  const before = xpOf(model, baseline, p);
  if (xpot === null || before === null) return { ok: false, why: 'not enough to price this putt' };
  return { ok: true, xpot, cost: xpot - before };
}

/** The same answer for a whole round, where no single putt is in question. */
export function xpotReason(exec: ExecModel): string {
  if (exec.confounded) {
    return `needs putts struck badly and holed anyway · ${exec.faultyMakes} of 5`;
  }
  if (!exec.estimable) return `needs judged strokes · ${exec.nClean + exec.nFaulty} so far`;
  if (!exec.predictive) {
    return `gap ${Math.round((exec.gap ?? 0) * 100)} pts, margin ${Math.round((exec.band ?? 0) * 100)}`;
  }
  return '';
}

export interface ReadBias {
  /** Played more break than it took: the ball held the high side. */
  over: number;
  /** Played less than it took: the ball fell to the low side. */
  under: number;
  /** Line and break agreed. */
  agreed: number;
  n: number;
  fromMisses: number;
}

/**
 * Whether you tend to play too much break or too little, from what you watched rather than from
 * what you decided about yourself.
 *
 * Both halves land on one axis, which is the point. A miss already records whether it finished
 * high or low, where high is the side the ball breaks from. A make records which side of the cup
 * it crossed, and on a left-to-right putt the high side is the left. So a miss finishing high and
 * a make entering left say the same thing: more break than it took.
 *
 * Until now the makes were silent, so a read tendency was being inferred from misses alone, which
 * is the tail of the pattern rather than the pattern.
 */
export function readBias(rounds: AnyRound[]): ReadBias {
  let over = 0;
  let under = 0;
  let agreed = 0;
  let fromMisses = 0;

  for (const r of rounds) {
    if (r.deleted) continue;
    for (const h of r.holes) {
      for (const p of h.putts) {
        const bucket = breakBucket(breakDirsOf(p));
        // Only a putt that turns one way has a high side to miss on.
        if (bucket !== 'lr' && bucket !== 'rl') continue;

        if (p.made || !p.missSide) continue;
        fromMisses += 1;
        if (p.missSide === 'online') agreed += 1;
        else if (p.missSide === 'high') over += 1;
        else under += 1;
      }
    }
  }
  return { over, under, agreed, n: over + under + agreed, fromMisses };
}

export interface LooseEnd {
  hole: number;
  index: number;
  d: number;
  what: 'read amount';
}

/**
 * Tags that were started and not finished, so they can be closed after the round rather than
 * slowing it down.
 *
 * Only one thing qualifies: a breaking putt with a direction and no amount, which gets priced as
 * "slight" by default. That is the honest fallback and wrong more often than not, and a single tap
 * fixes it.
 *
 * A missing `executionAssessed` deliberately does not qualify, though it is the other thing the
 * models want. That flag only exists on putts logged since it shipped, so listing it would ask
 * someone to reopen every older putt and re-confirm a stroke they had already tagged. Those putts
 * cannot enter the execution fit and that is the cost of adding the flag honestly, not a chore to
 * hand back to the player.
 */
export function looseEnds(holes: { hole: number; putts: Putt[] }[]): LooseEnd[] {
  const out: LooseEnd[] = [];
  for (const h of holes) {
    h.putts.forEach((p, index) => {
      const bucket = breakBucket(breakDirsOf(p));
      const turns = bucket === 'lr' || bucket === 'rl' || bucket === 'double';
      if (turns && !(p.brokeAs ?? p.readAs)) {
        out.push({ hole: h.hole, index, d: p.d, what: 'read amount' });
      }
    });
  }
  return out;
}
