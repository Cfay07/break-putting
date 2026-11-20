import { holeSG } from './sg';
import type { Hole, Round } from './types';

/**
 * Putting in the situations your rounds already record but nothing read: what you do with the
 * greens you hit and the ones you miss, with and without a card in your pocket, on true and bumpy
 * greens, and at each stage of a round.
 */

const counted = (rounds: Round[]) => rounds.filter((r) => r.finished && !r.practice);
const scored = (h: Hole) => h.par !== undefined && (h.strokes ?? 0) > 0;
/** On in regulation: two putts left for par. A chip-in from off the green is not a green hit. */
const greenHit = (h: Hole) => scored(h) && h.putts.length > 0 && h.strokes! - h.putts.length <= h.par! - 2;

export interface Conversion {
  greens: number;
  birdies: number;
  missed: number;
  saves: number;
}

/** Birdies or better from greens hit, and pars or better from greens missed. */
export function conversion(rounds: Round[]): Conversion {
  const holes = rounds.flatMap((r) => r.holes.filter(scored));
  const hit = holes.filter(greenHit);
  const missed = holes.filter((h) => !greenHit(h));
  return {
    greens: hit.length,
    birdies: hit.filter((h) => h.strokes! < h.par!).length,
    missed: missed.length,
    saves: missed.filter((h) => h.strokes! <= h.par!).length,
  };
}

export interface GroupLine {
  label: string;
  rounds: number;
  holes: number;
  /** Per 18 holes so nines and eighteens sit together. */
  sg: number | null;
  putts: number | null;
  threes: number | null;
  short: { made: number; tried: number };
  conv: Conversion;
}

function line(label: string, rounds: Round[], holes: Hole[], baseline: [number, number][]): GroupLine {
  const putted = holes.filter((h) => h.putts.length > 0);
  const per18 = (n: number) => (putted.length ? (n / putted.length) * 18 : null);
  const sg = putted.reduce(
    (a, h) =>
      a +
      holeSG(
        baseline,
        h.putts.map((p) => p.d),
        h.putts.length,
      ),
    0,
  );
  const short = holes.flatMap((h) => h.putts.filter((p) => p.d >= 3 && p.d <= 10));
  return {
    label,
    rounds: rounds.length,
    holes: putted.length,
    sg: per18(sg),
    putts: per18(putted.reduce((a, h) => a + h.putts.length, 0)),
    threes: per18(putted.filter((h) => h.putts.length >= 3).length),
    short: { made: short.filter((p) => p.made).length, tried: short.length },
    conv: conversion([{ holes } as Round]),
  };
}

/** Rounds split into named groups, each read the same way. Empty groups are left out. */
export function compare(groups: { label: string; rounds: Round[] }[], baseline: [number, number][]): GroupLine[] {
  return groups
    .map((g) => ({ ...g, rounds: counted(g.rounds) }))
    .filter((g) => g.rounds.length > 0)
    .map((g) =>
      line(
        g.label,
        g.rounds,
        g.rounds.flatMap((r) => r.holes),
        baseline,
      ),
    );
}

export const tournamentVsCasual = (rounds: Round[], baseline: [number, number][]) =>
  compare(
    [
      { label: 'Tournament', rounds: rounds.filter((r) => r.competitive) },
      { label: 'Casual', rounds: rounds.filter((r) => !r.competitive) },
    ],
    baseline,
  );

/** How true the greens rolled, as you marked it: 1 smooth, 2 average, 3 bumpy. Unmarked rounds stay out. */
export const byTrueness = (rounds: Round[], baseline: [number, number][]) =>
  compare(
    [
      { label: 'Smooth', rounds: rounds.filter((r) => r.bumpy === 1) },
      { label: 'Average', rounds: rounds.filter((r) => r.bumpy === 2) },
      { label: 'Bumpy', rounds: rounds.filter((r) => r.bumpy === 3) },
    ],
    baseline,
  );

/**
 * Each stage of a round, in the order the holes were played: the first three, the hole you lose
 * the most on, the last three, then the two nines of an eighteen. A shotgun start still reads right, since it goes
 * by order played rather than hole number.
 */
export function byStretch(rounds: Round[], baseline: [number, number][]): GroupLine[] {
  const rs = counted(rounds);
  const played = (r: Round) => r.holes.filter((h) => h.putts.length > 0 || scored(h));
  const pick = (f: (holes: Hole[]) => Hole[]) => rs.flatMap((r) => f(played(r)));
  const eighteens = rs.filter((r) => played(r).length >= 18);
  const out = [
    line(
      'First 3 holes',
      rs,
      pick((hs) => hs.slice(0, 3)),
      baseline,
    ),
    ...worstPosition(rs, played, baseline),
    line(
      'Last 3 holes',
      rs,
      pick((hs) => hs.slice(-3)),
      baseline,
    ),
  ];
  if (eighteens.length) {
    out.push(
      line(
        'Front nine',
        eighteens,
        eighteens.flatMap((r) => played(r).slice(0, 9)),
        baseline,
      ),
      line(
        'Back nine',
        eighteens,
        eighteens.flatMap((r) => played(r).slice(9, 18)),
        baseline,
      ),
    );
  }
  return out.filter((l) => l.holes > 0);
}

/** Holes at one spot in the order before that spot can be called your worst. */
const MIN_AT_SPOT = 10;

const ordinalOf = (n: number) => {
  const t = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${t}`;
};

/** The spot in the round (the 1st hole played, the 2nd...) where you give back the most, on average. */
function worstPosition(rs: Round[], played: (r: Round) => Hole[], baseline: [number, number][]): GroupLine[] {
  const spots = new Map<number, Hole[]>();
  for (const r of rs)
    played(r).forEach((h, i) => {
      if (h.putts.length) spots.set(i, [...(spots.get(i) ?? []), h]);
    });
  const lines = [...spots.entries()]
    .filter(([, holes]) => holes.length >= MIN_AT_SPOT)
    .map(([i, holes]) => line(`Worst hole: the ${ordinalOf(i + 1)}`, rs, holes, baseline))
    .filter((l) => l.sg !== null);
  if (!lines.length) return [];
  return [lines.reduce((a, l) => (l.sg! < a.sg! ? l : a))];
}
