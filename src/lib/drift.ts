import type { Round } from './types';

export interface Drift {
  /** Consecutive misses on different greens, in the order played. */
  pairs: number;
  agreed: number;
  /** Share of those pairs that went the same side, against a 50% coin flip. */
  rate: number | null;
  /** How many standard errors off a coin flip. Past 2 it is unlikely to be noise. */
  z: number | null;
  high: number;
  low: number;
  /** The side it leans to, once there is enough to say. */
  lean: 'high' | 'low' | null;
}

/** Below this the agreement rate is just noise and should not be drawn. */
export const MIN_PAIRS = 25;

/**
 * Does a miss predict the next one?
 *
 * Every putting stat in golf pools putts and throws the order away. This one only exists in the
 * order played: after you miss high, is the next miss high too? That is the thing players mean
 * by their eye being off, and nobody measures it.
 *
 * Pairs on the same green are left out on purpose. Missing high twice on one hole is a single
 * misread seen twice, not a tendency carrying across the round, and counting it would inflate
 * the number with the one thing it is not trying to measure.
 */
export function driftOf(rounds: Round[]): Drift {
  let pairs = 0;
  let agreed = 0;
  let high = 0;
  let low = 0;

  for (const round of rounds) {
    if (!round.finished) continue;
    let prev: { side: 'high' | 'low'; hole: number } | null = null;

    for (const hole of [...round.holes].sort((a, b) => a.hole - b.hole)) {
      for (const putt of hole.putts) {
        const side = putt.missSide;
        if (side !== 'high' && side !== 'low') continue;
        if (side === 'high') high++;
        else low++;
        if (prev && prev.hole !== hole.hole) {
          pairs++;
          if (prev.side === side) agreed++;
        }
        prev = { side, hole: hole.hole };
      }
    }
  }

  if (pairs < MIN_PAIRS) {
    return { pairs, agreed, rate: null, z: null, high, low, lean: null };
  }

  const rate = agreed / pairs;
  // Standard error of a proportion under the 50/50 null.
  const z = (rate - 0.5) / Math.sqrt(0.25 / pairs);
  // A count alone is not a lean. 114 high against 110 low is a coin landing the way coins do,
  // and printing "you lean high" off that is how a stat page starts lying to you.
  const sided = high + low;
  const leanZ = sided ? Math.abs(high - low) / Math.sqrt(sided) : 0;
  const lean = leanZ >= 1.5 ? (high > low ? 'high' : 'low') : null;
  return { pairs, agreed, rate, z, high, low, lean };
}
