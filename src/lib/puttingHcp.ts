import { holedOut, type Round } from './types';
import { roundSG } from './sg';

/**
 * Strokes gained here is against tour. Broadie: a tour pro plays to about +6 and putts about one
 * stroke a round better than scratch, one putting stroke per six handicap strokes. Arccos has
 * 11-15 handicaps losing 1.99 a round putting to scratch, which lands on the same line.
 */
export const TOUR_HCP = -6;
export const HCP_PER_STROKE = 6;
/** How fast a round better than tour keeps improving. A judgment call, not a researched figure. */
const PAST_TOUR = 1.5;
export const HCP_WINDOW = 20;
export const HCP_MIN_ROUNDS = 5;

/**
 * Your best 40%: 8 of 20, and the same share before the window fills (2 of 5, 4 of 10), one rule
 * where the official system uses a lookup table. A handicap is what you can play to, not your average.
 */
export const countingOf = (n: number) => Math.max(1, Math.round(n * 0.4));

/**
 * Six handicap strokes per putting stroke, up to tour level. The research behind that line stops
 * at tour, and running it past there read one hot nine as +28.5. Past tour a round still gets
 * better, with no ceiling, but each extra stroke counts for less: +0.5 on tour reads about +6.6,
 * +4 about +8.4.
 */
const toHcp = (sgVsTour: number) =>
  sgVsTour <= 0 ? TOUR_HCP - sgVsTour * HCP_PER_STROKE : TOUR_HCP - PAST_TOUR * Math.log(1 + sgVsTour);

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

/** Your best 8 of your last 20 rounds, averaged, for Plays to and Putts to alike. Oldest first in. */
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

/** Each round on the handicap scale, then the same best 8 of your last 20 as Plays to. */
export function puttingHcp(rounds: Round[], baseline: [number, number][]): PuttingHcp | null {
  const real = rounds
    .filter((r) => r.finished && !r.practice && r.holes.some((h) => h.putts.length))
    .sort((a, b) => a.date.localeCompare(b.date));
  return bestOf(eighteens(real, baseline).map((r) => ({ id: r.id, date: r.date, nines: r.nines, hcp: toHcp(r.sg) })));
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
