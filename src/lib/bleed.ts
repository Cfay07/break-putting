import { holeVsPar, type Hole, type Round } from './types';

/** How close a putt has to be before missing it counts as a mistake worth tracking. */
export const MAKEABLE = { min: 3, max: 6 };

export interface Bleed {
  date: string;
  triggerHole: number;
  why: string;
  holes: number[];
  shots: number;
  triggers: number;
  stopped: boolean;
}

/** The hole that starts a bleed: a three-putt, or a short putt missed on a hole that cost you. */
export function triggerOn(h: Hole): string | null {
  if (!h.putts.length) return null;
  if (h.putts.length >= 4) return 'four-putt';
  if (h.putts.length >= 3) return 'three-putt';
  const vsPar = holeVsPar(h);
  if (vsPar === undefined || vsPar < 1) return null;
  const missed = h.putts
    .slice(0, -1)
    .find((p) => !p.made && p.d >= MAKEABLE.min && p.d <= MAKEABLE.max);
  return missed ? `missed ${missed.d} ft` : null;
}

/**
 * Every bleed in a round. A bleed runs from the hole after a trigger until the first hole played
 * at par or better. A fresh trigger part way through extends the same bleed rather than starting
 * a new one, because the bleeding never stopped.
 */
export function bleedsIn(round: Round): Bleed[] {
  const holes = round.holes.filter((h) => h.putts.length || holeVsPar(h) !== undefined);
  const out: Bleed[] = [];
  let i = 0;

  while (i < holes.length) {
    const why = triggerOn(holes[i]);
    if (!why) {
      i += 1;
      continue;
    }

    const bled: number[] = [];
    let shots = 0;
    let triggers = 1;
    let stopped = false;
    let j = i + 1;

    while (j < holes.length) {
      const vsPar = holeVsPar(holes[j]);
      if (vsPar === undefined) break;
      if (vsPar <= 0) {
        stopped = true;
        break;
      }
      bled.push(holes[j].hole);
      shots += vsPar;
      if (triggerOn(holes[j])) triggers += 1;
      j += 1;
    }

    out.push({ date: round.date, triggerHole: holes[i].hole, why, holes: bled, shots, triggers, stopped });
    i = Math.max(j, i + 1);
  }

  return out;
}

export interface BleedSummary {
  count: number;
  perRound: number | null;
  stoppedAtOnce: number | null;
  averageLength: number | null;
  shotsPerRound: number | null;
  compound: number;
  worst: Bleed | null;
  lengths: { label: string; count: number }[];
  /** Par or better on the hole after a trigger, against every other hole. */
  afterRate: number | null;
  normalRate: number | null;
  sample: number;
}

export function bleedSummary(rounds: Round[]): BleedSummary {
  const all = rounds.flatMap(bleedsIn);
  const n = rounds.length;

  let after = 0;
  let afterGood = 0;
  let other = 0;
  let otherGood = 0;

  for (const round of rounds) {
    const holes = round.holes.filter((h) => holeVsPar(h) !== undefined);
    for (let i = 1; i < holes.length; i++) {
      const good = (holeVsPar(holes[i]) ?? 1) <= 0;
      if (triggerOn(holes[i - 1])) {
        after += 1;
        if (good) afterGood += 1;
      } else {
        other += 1;
        if (good) otherGood += 1;
      }
    }
  }

  const buckets = [0, 1, 2, 3];
  const lengths = buckets.map((b) => ({
    label: b === 3 ? '3+' : String(b),
    count: all.filter((x) => (b === 3 ? x.holes.length >= 3 : x.holes.length === b)).length,
  }));

  return {
    count: all.length,
    perRound: n ? all.length / n : null,
    stoppedAtOnce: all.length ? all.filter((b) => b.holes.length === 0).length / all.length : null,
    averageLength: all.length ? all.reduce((s, b) => s + b.holes.length, 0) / all.length : null,
    shotsPerRound: n ? all.reduce((s, b) => s + b.shots, 0) / n : null,
    compound: all.filter((b) => b.triggers > 1).length,
    worst: all.length ? all.reduce((w, b) => (b.shots > w.shots ? b : w)) : null,
    lengths,
    afterRate: after ? afterGood / after : null,
    normalRate: other ? otherGood / other : null,
    sample: after,
  };
}

/** Holes marked on a scorecard: the trigger itself, and everything it bled into. */
export function bleedMarks(round: Round): { triggers: Set<number>; bled: Set<number> } {
  const triggers = new Set<number>();
  const bled = new Set<number>();
  for (const b of bleedsIn(round)) {
    triggers.add(b.triggerHole);
    for (const h of b.holes) bled.add(h);
  }
  return { triggers, bled };
}

/** Mid-round: are you bleeding right now, and for how many holes. */
export function liveBleed(round: Round): { bleeding: boolean; holes: number } {
  const played = round.holes.filter((h) => h.putts.some((p) => p.made));
  if (!played.length) return { bleeding: false, holes: 0 };

  let bleeding = false;
  let holes = 0;
  for (const h of played) {
    const vsPar = holeVsPar(h);
    if (bleeding) {
      if (vsPar === undefined) continue;
      if (vsPar <= 0) {
        bleeding = false;
        holes = 0;
        continue;
      }
      holes += 1;
    }
    if (triggerOn(h)) bleeding = true;
  }
  return { bleeding, holes };
}
