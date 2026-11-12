import { holedOut, type Round } from './types';
import { roundSG } from './sg';

/**
 * Strokes gained here is against tour. Broadie: a tour pro plays to about +6 and putts about one
 * stroke a round better than scratch, one putting stroke per six handicap strokes. Arccos has
 * 11-15 handicaps losing 1.99 a round putting to scratch, which lands on the same line.
 */
export const TOUR_HCP = -6;
export const HCP_PER_STROKE = 6;
export const HCP_WINDOW = 20;
export const HCP_MIN_ROUNDS = 5;

/**
 * Your best 40%: 8 of 20, and the same share before the window fills (2 of 5, 4 of 10), one rule
 * where the official system uses a lookup table. A handicap is what you can play to, not your average.
 */
export const countingOf = (n: number) => Math.max(1, Math.round(n * 0.4));

/** No ceiling or floor on the average: putting better than tour reads better than +6. */
const toHcp = (sg: number) => TOUR_HCP - sg * HCP_PER_STROKE;

export function hcpText(h: number): string {
  const n = Math.round(h * 10) / 10;
  return n < 0 ? `+${(-n).toFixed(1)}` : n.toFixed(1);
}

export interface HcpRound {
  id: string;
  date: string;
  hcp: number;
  counts: boolean;
  /** Two nine-hole rounds scored as one eighteen. */
  nines: boolean;
  /** Strokes gained putting over eighteen. Putting rounds only. */
  sg?: number;
}

export interface PuttingHcp {
  hcp: number;
  counting: number;
  /** Your last rounds, newest first. */
  rounds: HcpRound[];
  /** The round the next one pushes out, once the window is full. */
  nextOut: HcpRound | null;
}

const played = (r: Round) => r.holes.filter((h) => h.putts.length > 0 || holedOut(h)).length;

/**
 * Two nines make one eighteen, the way handicaps used to pair them. Doubling a nine instead lets one
 * hot stretch count as a whole round, and a best-of average picks exactly those.
 */
function eighteens(rounds: Round[], baseline: [number, number][]) {
  const out: { id: string; date: string; sg: number; nines: boolean }[] = [];
  let waiting: Round | null = null;
  for (const r of rounds) {
    const holes = played(r);
    if (holes > 9) {
      out.push({ id: r.id, date: r.date, sg: (roundSG(r, baseline) * 18) / holes, nines: false });
    } else if (waiting) {
      const sg = ((roundSG(waiting, baseline) + roundSG(r, baseline)) * 18) / (played(waiting) + holes);
      out.push({ id: `${waiting.id}+${r.id}`, date: r.date, sg, nines: true });
      waiting = null;
    } else waiting = r;
  }
  return out;
}

export interface Scored {
  id: string;
  date: string;
  nines: boolean;
  hcp: number;
}

/** Your best 8 of your last 20 rounds, averaged. Oldest first in. */
export function bestOf(all: Scored[]): PuttingHcp | null {
  const each = all.slice(-HCP_WINDOW);
  if (each.length < HCP_MIN_ROUNDS) return null;
  const counting = countingOf(each.length);
  const best = new Set([...each].sort((a, b) => a.hcp - b.hcp).slice(0, counting).map((r) => r.id));
  const counted = each.filter((r) => best.has(r.id));
  const marked = each.map((r) => ({ ...r, counts: best.has(r.id) }));
  return {
    hcp: counted.reduce((a, r) => a + r.hcp, 0) / counted.length,
    counting,
    rounds: [...marked].reverse(),
    nextOut: marked.length === HCP_WINDOW ? marked[0] : null,
  };
}

/**
 * Every one of your last 20 counts here, not the best 8. The six-per-stroke scale is built from
 * averages: players at a handicap lose this much putting on average. One round of putting swings
 * about four strokes either way for everyone, so converting single rounds and picking the best
 * ones crowns lucky days (one hot nine read as +28). Average the strokes gained, convert once.
 */
export function puttingHcp(rounds: Round[], baseline: [number, number][]): PuttingHcp | null {
  const real = rounds
    .filter((r) => r.finished && !r.practice && r.holes.some((h) => h.putts.length))
    .sort((a, b) => a.date.localeCompare(b.date));
  const each = eighteens(real, baseline).slice(-HCP_WINDOW);
  if (each.length < HCP_MIN_ROUNDS) return null;
  const marked = each.map((r) => ({ id: r.id, date: r.date, nines: r.nines, sg: r.sg, hcp: toHcp(r.sg), counts: true }));
  return {
    hcp: toHcp(each.reduce((a, r) => a + r.sg, 0) / each.length),
    counting: each.length,
    rounds: [...marked].reverse(),
    nextOut: marked.length === HCP_WINDOW ? marked[0] : null,
  };
}

/** Your handicap without this round and with it, and whether it is one of the rounds counting. */
export function hcpMove(
  rounds: Round[],
  round: Round,
  index: (rounds: Round[]) => PuttingHcp | null,
) {
  const sorted = rounds
    .filter((r) => r.finished && !r.practice)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id === round.id ? 1 : b.id === round.id ? -1 : 0));
  const i = sorted.findIndex((r) => r.id === round.id);
  if (i < 0) return null;
  const after = index(sorted.slice(0, i + 1));
  if (!after) return null;
  const mine = after.rounds.find((r) => r.id.split('+').includes(round.id));
  return { before: index(sorted.slice(0, i)), after, counts: mine?.counts ?? false, waiting: !mine };
}
