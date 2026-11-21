import { roundScale } from './stats';
import { holeVsPar, type Hole, type Round } from './types';

/**
 * Bleed is what putting mistakes put on your scorecard. Stitch is how you answer on the next
 * hole. Both stay honest the same way: a mistake is charged the strokes it actually cost on its
 * own hole, and anything after it is compared against your other holes, never counted as caused.
 * The old Bleed charged every bogey after a miss to the miss and called it 1.6 a round, when the
 * holes after a mistake scored the same as the rest.
 */

/**
 * How close a putt has to be before missing it counts as a mistake worth tracking. There used
 * to be a three foot floor under this, which excluded the one miss that tilts you most: a
 * two-footer missed is a worse mistake than a six-footer missed, not a lesser one.
 */
export const MAKEABLE = { max: 6 };

/** A three-putt, or a putt missed from makeable range. What the hole scored does not enter into it. */
export function triggerOn(h: Hole): string | null {
  if (!h.putts.length) return null;
  if (h.putts.length >= 4) return 'four-putt';
  if (h.putts.length >= 3) return 'three-putt';
  const missed = h.putts.slice(0, -1).find((p) => !p.made && p.d <= MAKEABLE.max);
  return missed ? `missed ${missed.d} ft` : null;
}

/**
 * Strokes the mistake itself put on the card: every putt past two, or the one stroke a missed
 * short first putt cost. Counted on the hole, so it always matches the scorecard.
 */
export function mistakeStrokes(h: Hole): number {
  if (!triggerOn(h)) return 0;
  return h.putts.length >= 3 ? h.putts.length - 2 : 1;
}

export interface Bleed {
  date: string;
  triggerHole: number;
  why: string;
  /** Holes over par that came next, before your next par or better. What followed, not what it caused. */
  holes: number[];
  /** Strokes the mistakes in this stretch put on the card. */
  shots: number;
  triggers: number;
  stopped: boolean;
  /** The first hole at par or better after it: where you stitched it. */
  stitchHole: number | null;
}

/**
 * Every mistake in a round and what followed it, in order: "missed 5 ft on the 2nd, then over par
 * on 3 and 4". A fresh mistake inside the stretch joins it, so a run of them reads as one story.
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

    const followed: number[] = [];
    let shots = mistakeStrokes(holes[i]);
    let triggers = 1;
    let stopped = false;
    let stitchHole: number | null = null;
    let j = i + 1;

    while (j < holes.length) {
      const vsPar = holeVsPar(holes[j]);
      if (vsPar === undefined) break;
      if (vsPar <= 0 && !triggerOn(holes[j])) {
        stopped = true;
        stitchHole = holes[j].hole;
        break;
      }
      if (vsPar > 0) followed.push(holes[j].hole);
      if (triggerOn(holes[j])) {
        triggers += 1;
        shots += mistakeStrokes(holes[j]);
      }
      j += 1;
    }

    out.push({
      date: round.date,
      triggerHole: holes[i].hole,
      why,
      holes: followed,
      shots,
      triggers,
      stopped,
      stitchHole,
    });
    i = Math.max(j, i + 1);
  }

  return out;
}

const playedHoles = (r: Round) => r.holes.filter((h) => h.putts.length > 0);

export interface BleedSummary {
  /** Strokes a round putting mistakes put on the card, nines counted as eighteens. */
  shotsPerRound: number | null;
  threePuttsPerRound: number | null;
  shortMissesPerRound: number | null;
  /** Scoring average, and the same rounds with every mistake two-putted or holed. Scored rounds only. */
  avgScore: number | null;
  withoutScore: number | null;
  /** The hole after a mistake against every other hole: over par, and two over-par holes in a row. */
  afterOver: number | null;
  normalOver: number | null;
  afterRun: number | null;
  normalRun: number | null;
  /** Par or better on the hole after a mistake, against every other hole. */
  afterRate: number | null;
  normalRate: number | null;
  /** Holes played right after a mistake. */
  sample: number;
  rounds: number;
}

export function bleedSummary(rounds: Round[]): BleedSummary {
  const n = rounds.length;
  let three = 0;
  let short = 0;
  let scored = 0;
  let scoreSum = 0;
  let withoutSum = 0;
  const after = { n: 0, over: 0, run: 0, good: 0 };
  const other = { n: 0, over: 0, run: 0, good: 0 };

  for (const r of rounds) {
    const k = roundScale(r);
    let t = 0;
    let s = 0;
    for (const h of playedHoles(r)) {
      if (!triggerOn(h)) continue;
      if (h.putts.length >= 3) t += h.putts.length - 2;
      else s += 1;
    }
    three += t * k;
    short += s * k;
    const holes = r.holes.filter((h) => holeVsPar(h) !== undefined && (h.putts.length || h.holedOut));
    // The same rounds and the same scaling as "What you would be shooting", so the two averages agree.
    if (r.score !== undefined) {
      scored++;
      scoreSum += r.score * k;
      withoutSum += (r.score - t - s) * k;
    }
    for (let i = 0; i < holes.length - 1; i++) {
      const g = triggerOn(holes[i]) ? after : other;
      const over = holeVsPar(holes[i + 1])! > 0;
      g.n++;
      if (over) g.over++;
      else g.good++;
      if (over && i + 2 < holes.length && holeVsPar(holes[i + 2])! > 0) g.run++;
    }
  }

  const rate = (x: number, of: number) => (of ? x / of : null);
  return {
    shotsPerRound: n ? (three + short) / n : null,
    threePuttsPerRound: n ? three / n : null,
    shortMissesPerRound: n ? short / n : null,
    avgScore: scored ? scoreSum / scored : null,
    withoutScore: scored ? withoutSum / scored : null,
    afterOver: rate(after.over, after.n),
    normalOver: rate(other.over, other.n),
    afterRun: rate(after.run, after.n),
    normalRun: rate(other.run, other.n),
    afterRate: rate(after.good, after.n),
    normalRate: rate(other.good, other.n),
    sample: after.n,
    rounds: n,
  };
}

/** Feet bands for a putter's own make rate from 3 to 10 feet. */
const SHORT_BANDS = [4, 6, 8, 10];
const shortBand = (d: number) => SHORT_BANDS.findIndex((max) => d <= max);

export interface StitchSummary {
  /** Par or better on the hole after a mistake, and on every other hole. */
  afterRate: number | null;
  normalRate: number | null;
  /** Putts from 3 to 10 ft on the hole after a mistake, and what your usual at those lengths says. */
  nextShort: { made: number; tried: number; usual: number };
  /** Another putting mistake on the very next hole, after a mistake and otherwise. */
  chainAfter: number | null;
  chainNormal: number | null;
  sample: number;
}

/**
 * How you answer on the next hole. Usual comes from each putter's own make rates, because the
 * mistakes clustered in the months with the worse putter and judging those holes against the
 * better one would invent a slump that was really a putter.
 */
export function stitchSummary(rounds: Round[]): StitchSummary {
  const rates = new Map<string, { made: number; tried: number }[]>();
  for (const r of rounds) {
    const bands = rates.get(r.putterId) ?? SHORT_BANDS.map(() => ({ made: 0, tried: 0 }));
    rates.set(r.putterId, bands);
    for (const h of r.holes)
      for (const p of h.putts)
        if (p.d >= 3 && p.d <= 10) {
          const b = bands[shortBand(p.d)];
          b.tried++;
          if (p.made) b.made++;
        }
  }

  const nextShort = { made: 0, tried: 0, usual: 0 };
  const after = { n: 0, good: 0, chain: 0 };
  const other = { n: 0, good: 0, chain: 0 };
  for (const r of rounds) {
    const bands = rates.get(r.putterId)!;
    const holes = r.holes.filter((h) => holeVsPar(h) !== undefined || h.putts.length);
    for (let i = 0; i < holes.length - 1; i++) {
      const mistake = !!triggerOn(holes[i]);
      const next = holes[i + 1];
      const g = mistake ? after : other;
      g.n++;
      if ((holeVsPar(next) ?? 1) <= 0) g.good++;
      if (triggerOn(next)) g.chain++;
      if (!mistake) continue;
      for (const p of next.putts)
        if (p.d >= 3 && p.d <= 10) {
          const b = bands[shortBand(p.d)];
          nextShort.tried++;
          nextShort.usual += b.tried ? b.made / b.tried : 0;
          if (p.made) nextShort.made++;
        }
    }
  }

  const rate = (x: number, of: number) => (of ? x / of : null);
  return {
    afterRate: rate(after.good, after.n),
    normalRate: rate(other.good, other.n),
    nextShort,
    chainAfter: rate(after.chain, after.n),
    chainNormal: rate(other.chain, other.n),
    sample: after.n,
  };
}

const ordinal = (n: number) => {
  const t = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${t}`;
};
const list = (ns: number[]) => (ns.length < 2 ? ns.join('') : `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`);

/** "Missed 5 ft on the 2nd, 1 stroke. Then over par on 3 and 4." What happened, in order, nothing claimed. */
export function bleedStory(b: Bleed): string {
  const first = `${b.why[0].toUpperCase()}${b.why.slice(1)} on the ${ordinal(b.triggerHole)}`;
  const cost = `${b.shots} stroke${b.shots === 1 ? '' : 's'}${b.triggers > 1 ? ` from ${b.triggers} mistakes` : ''}`;
  const then = b.holes.length ? ` Then over par on ${list(b.holes)}.` : '';
  return `${first}, ${cost}.${then}`;
}

/** For the round card: "Bled 2 · missed 5 ft on the 2nd, three-putt on the 14th". Null on a clean round. */
export function bleedLine(round: Round): string | null {
  const holes = round.holes.filter((h) => triggerOn(h));
  const strokes = holes.reduce((n, h) => n + mistakeStrokes(h), 0);
  if (!strokes) return null;
  return `Bled ${strokes} · ${holes.map((h) => `${triggerOn(h)} on the ${ordinal(h.hole)}`).join(', ')}`;
}

/** Holes marked on a scorecard: the mistake, the over-par holes that followed it, and where you stitched it. */
export function bleedMarks(round: Round): { triggers: Set<number>; bled: Set<number>; stitched: Set<number> } {
  const triggers = new Set<number>();
  const bled = new Set<number>();
  const stitched = new Set<number>();
  for (const b of bleedsIn(round)) {
    triggers.add(b.triggerHole);
    for (const h of b.holes) bled.add(h);
    if (b.stitchHole !== null) stitched.add(b.stitchHole);
  }
  for (const h of round.holes) if (triggerOn(h)) triggers.add(h.hole);
  for (const h of triggers) bled.delete(h);
  return { triggers, bled, stitched };
}

/** Mid-round: strokes putting mistakes have put on the card so far. Matches the scorecard. */
export function liveBleed(round: Round): { strokes: number } {
  const done = round.holes.filter((h) => h.putts.some((p) => p.made));
  return { strokes: done.reduce((n, h) => n + mistakeStrokes(h), 0) };
}
