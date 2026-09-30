import { puttSG } from './sg';
import {
  BREAK_BUCKETS,
  breakBucket,
  breakDirsOf,
  slopeOf,
  type BreakBucket,
  type Round,
} from './types';

/**
 * Every published expected-putts table is distance only. Tour numbers average over whatever break
 * the field happened to face, so there is no outside source that says what a six-foot double
 * breaker is worth. This learns it from one player's own tagged putts instead.
 *
 * The adjustments are centred so they sum to zero across the tagged set. That is deliberate: a
 * player cannot gain strokes by discovering their putts were hard. Strokes gained stays measured
 * against tour and the season total does not move. What moves is which putts get the blame.
 */

/** Sample at which a bucket's adjustment counts for half of what its raw numbers say. */
const SHRINK = 40;

/** Below this there is nothing worth showing anybody. */
export const MIN_TAGGED = 60;

export type SlopeKey = 'uphill' | 'downhill';

interface Sample {
  bucket: BreakBucket | null;
  slope: SlopeKey | null;
  /** How much worse than the distance-only model this putt actually went. */
  residual: number;
}

export interface Axis<K extends string> {
  /** Strokes to add to the expectation for a putt in this bucket. Positive means harder. */
  adj: Record<K, number>;
  n: Record<K, number>;
}

export interface BreakModel {
  break: Axis<BreakBucket>;
  slope: Axis<SlopeKey>;
  tagged: number;
  ready: boolean;
}

function samplesFrom(rounds: Round[], baseline: [number, number][]): Sample[] {
  const out: Sample[] = [];
  for (const round of rounds) {
    for (const h of round.holes) {
      for (const [i, p] of h.putts.entries()) {
        const dirs = breakDirsOf(p);
        if (!dirs.length) continue;
        const leave = p.made ? null : (h.putts[i + 1]?.d ?? null);
        const gained = puttSG(baseline, p.d, p.made, leave);
        if (gained === null) continue;
        out.push({ bucket: breakBucket(dirs), slope: slopeOf(dirs), residual: -gained });
      }
    }
  }
  return out;
}

/**
 * One axis of the model. Each bucket's raw number is how much worse it went than this player's
 * own average on tagged putts, so their overall standard drops out and what is left is the
 * relative difficulty. Thin buckets shrink toward zero rather than swinging on a handful of
 * putts, then the whole axis is re-centred so it still nets to nothing.
 */
function learnAxis<K extends string>(
  keys: readonly K[],
  samples: Sample[],
  keyOf: (s: Sample) => K | null,
): Axis<K> {
  const adj = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  const n = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

  const inAxis = samples.filter((s) => keyOf(s) !== null);
  if (!inAxis.length) return { adj, n };

  const mean = inAxis.reduce((sum, s) => sum + s.residual, 0) / inAxis.length;

  for (const k of keys) {
    const rows = inAxis.filter((s) => keyOf(s) === k);
    n[k] = rows.length;
    if (!rows.length) continue;
    const raw = rows.reduce((sum, s) => sum + s.residual, 0) / rows.length - mean;
    adj[k] = raw * (rows.length / (rows.length + SHRINK));
  }

  const weighted = keys.reduce((sum, k) => sum + adj[k] * n[k], 0) / inAxis.length;
  for (const k of keys) adj[k] -= weighted;

  return { adj, n };
}

export function learnBreak(rounds: Round[], baseline: [number, number][]): BreakModel {
  const samples = samplesFrom(rounds, baseline);
  return {
    break: learnAxis(BREAK_BUCKETS, samples, (s) => s.bucket),
    slope: learnAxis(['uphill', 'downhill'] as const, samples, (s) => s.slope),
    tagged: samples.length,
    ready: samples.length >= MIN_TAGGED,
  };
}

/** What this player's own data says a putt of this shape is worth on top of its distance. */
export function breakAdjustment(model: BreakModel, dirs: ReturnType<typeof breakDirsOf>): number {
  if (!model.ready) return 0;
  const bucket = breakBucket(dirs);
  const slope = slopeOf(dirs);
  return (bucket ? model.break.adj[bucket] : 0) + (slope ? model.slope.adj[slope] : 0);
}
