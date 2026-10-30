/**
 * One standard for "do we know this yet".
 *
 * The app grew ten separate sufficiency gates with ten names, two of which were the same name
 * meaning different things, and none of which the reader could see. A make rate off twelve
 * putts printed in the same typeface as one off nine hundred is the lie every golf app tells by
 * omission, and not telling it is the one thing BREAK! can be better at than anybody.
 *
 * Every gate still picks its own threshold, because a read pattern and a learned model need
 * genuinely different amounts. What is shared is the vocabulary and the way it is shown.
 */

import { signed } from './format';

export type Confidence = 'solid' | 'thin' | 'waiting';

export interface Sample {
  /** What we actually have. */
  n: number;
  /** What this particular stat needs before it is worth trusting. */
  need: number;
  /** What is being counted, in the reader's words: "putts", "rounds", "tagged misses". */
  unit: string;
}

export function sample(n: number, need: number, unit: string): Sample {
  return { n, need, unit };
}

/**
 * Half the requirement is the line between "nothing to say" and "a hint". Nothing magic about
 * it, but it is one number applied everywhere rather than a different judgement each time.
 */
export function confidenceOf(s: Sample): Confidence {
  if (s.n >= s.need) return 'solid';
  if (s.n >= Math.ceil(s.need / 2)) return 'thin';
  return 'waiting';
}

/** Two decimals have to be earned: -0.63 off 23 putts claims a precision 23 putts cannot give. */
export function digitsFor(s: Sample): number {
  return confidenceOf(s) === 'solid' ? 2 : 1;
}

export function signedFor(n: number, s: Sample): string {
  return signed(n, digitsFor(s));
}

/** The short form that sits beside a number. */
export function sampleLabel(s: Sample): string {
  return `${s.n} ${s.unit}`;
}

/** The sentence a stat says when it cannot speak yet. */
export function waitingText(s: Sample): string {
  // Guarded rather than trusted: called on a sample that is already past its gate it would
  // otherwise cheerfully ask for minus ten more putts.
  const short = Math.max(0, s.need - s.n);
  if (!short) return `${s.n} ${s.unit}, enough to read.`;
  return `${s.n} of ${s.need} ${s.unit}. ${short} more and this can speak.`;
}
