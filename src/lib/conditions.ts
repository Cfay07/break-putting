import { pct, roundScale, roundStats } from './stats';
import { RAIN_FLOOR } from './weather';
import type { Round } from './types';

export interface ConditionSplit {
  label: string;
  rounds: number;
  sgPerRound: number;
  puttsPerRound: number;
  scoringPct: number | null;
}

export interface ConditionSplits {
  rain: ConditionSplit[];
  aeration: ConditionSplit[];
  surface: ConditionSplit[];
  tagged: { rain: number; aeration: number; surface: number };
}

/** Both sides need this many rounds before a split is worth drawing at all. */
export const MIN_SIDE = 2;

function group(rounds: Round[], baseline: [number, number][], label: string): ConditionSplit {
  const stats = rounds.map((r) => ({ s: roundStats(r, baseline), scale: roundScale(r) }));
  const makes = stats.reduce((n, x) => n + x.s.scoring.makes, 0);
  const attempts = stats.reduce((n, x) => n + x.s.scoring.attempts, 0);
  return {
    label,
    rounds: rounds.length,
    sgPerRound: stats.reduce((n, x) => n + x.s.sg * x.scale, 0) / rounds.length,
    puttsPerRound: stats.reduce((n, x) => n + x.s.totalPutts * x.scale, 0) / rounds.length,
    scoringPct: pct({ makes, attempts, sg: 0, sgPutts: 0, high: 0, low: 0, online: 0 } as never),
  };
}

function split(
  rounds: Round[],
  baseline: [number, number][],
  pick: (r: Round) => string | null,
  order: string[],
): ConditionSplit[] {
  const buckets = new Map<string, Round[]>();
  for (const r of rounds) {
    const key = pick(r);
    if (key === null) continue;
    buckets.set(key, [...(buckets.get(key) ?? []), r]);
  }
  const out = order
    .filter((k) => (buckets.get(k)?.length ?? 0) > 0)
    .map((k) => group(buckets.get(k)!, baseline, k));
  // Nothing to compare against is not a comparison.
  return out.length >= 2 && out.every((g) => g.rounds >= MIN_SIDE) ? out : [];
}

/**
 * Conditions against performance. Nothing here feeds strokes gained or expected putts: it only
 * shows what the rounds looked like when the greens were against you, so the cost can eventually
 * be read off real rounds rather than guessed at.
 */
export function byConditions(rounds: Round[], baseline: [number, number][]): ConditionSplits {
  const played = rounds.filter((r) => r.finished);
  return {
    rain: split(
      played,
      baseline,
      (r) => (r.rainMm === undefined ? null : r.rainMm >= RAIN_FLOOR ? 'Wet' : 'Dry'),
      ['Dry', 'Wet'],
    ),
    aeration: split(
      played,
      baseline,
      (r) => (r.aerated === undefined ? null : r.aerated ? 'Aerated' : 'Not aerated'),
      ['Not aerated', 'Aerated'],
    ),
    surface: split(
      played,
      baseline,
      (r) => (r.bumpy === undefined ? null : ['Smooth', 'Average', 'Bumpy'][r.bumpy - 1] ?? null),
      ['Smooth', 'Average', 'Bumpy'],
    ),
    tagged: {
      rain: played.filter((r) => r.rainMm !== undefined).length,
      aeration: played.filter((r) => r.aerated !== undefined).length,
      surface: played.filter((r) => r.bumpy !== undefined).length,
    },
  };
}
