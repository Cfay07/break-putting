import { holeSG } from './sg';
import { courseKey } from './stats';
import type { Round } from './types';

/**
 * The Dial: your make rate at any length you dial in, from the filtered rounds. A single foot is
 * too few putts past a few feet, so the window widens a foot each side at a time until it holds
 * enough putts, and says which lengths it counted.
 */

export const DIAL_MAX = 60;
/** Up to here the dial reads the exact foot only, however few putts there are. */
const EXACT_TO = 6;
/** Putts a length's window grows to hold, before it stops widening. */
const DIAL_ENOUGH = 40;
/** Never wider than this either side, so 12 ft never borrows from 20 ft. */
const DIAL_SPREAD = 3;

const real = (rounds: Round[]) => rounds.filter((r) => r.finished && !r.practice);

interface P {
  d: number;
  made: boolean;
  roundId: string;
  date: string;
  course: string;
  hole: number;
}

function puttsOf(rounds: Round[]): P[] {
  return real(rounds).flatMap((r) =>
    r.holes.flatMap((h) =>
      h.putts.map((p) => ({ d: p.d, made: p.made, roundId: r.id, date: r.date, course: r.course ?? '', hole: h.hole })),
    ),
  );
}

export interface DialRead {
  d: number;
  made: number;
  tried: number;
  lo: number;
  hi: number;
}

export function dialAt(rounds: Round[], d: number): DialRead {
  const ps = puttsOf(rounds);
  let w = 0;
  let q = ps.filter((p) => p.d === d);
  // Short putts are logged to the foot and there are plenty of them: a 2 ft read is 2 ft only.
  while (d > EXACT_TO && q.length < DIAL_ENOUGH && w < DIAL_SPREAD) {
    w++;
    q = ps.filter((p) => Math.abs(p.d - d) <= w);
  }
  return { d, made: q.filter((p) => p.made).length, tried: q.length, lo: Math.max(1, d - w), hi: d + w };
}

export interface DialPutt {
  d: number;
  roundId: string;
  date: string;
  course: string;
  hole: number;
}

/** Your shortest miss and longest make in these rounds, each with where it happened. */
export function dialEnds(rounds: Round[]): { shortestMiss: DialPutt | null; longestMake: DialPutt | null } {
  const ps = puttsOf(rounds);
  const misses = ps.filter((p) => !p.made).sort((a, b) => a.d - b.d || b.date.localeCompare(a.date));
  const makes = ps.filter((p) => p.made).sort((a, b) => b.d - a.d || b.date.localeCompare(a.date));
  return { shortestMiss: misses[0] ?? null, longestMake: makes[0] ?? null };
}

/* ---------- Hole by hole ---------- */

export interface HoleRow {
  hole: number;
  par: number;
  played: number;
  /** Scoring average on the hole, and the same against its par. */
  avg: number;
  toPar: number;
  /** Every round played it at the same par: false only when courses are mixed. */
  samePar: boolean;
  eagle: number;
  birdie: number;
  pars: number;
  bogey: number;
  double: number;
  /** Putting strokes gained on the hole, on average. */
  sg: number | null;
  longestMake: number | null;
}

/**
 * One row per hole. With one course it is that course's scorecard; with several it still adds up
 * by hole number, flagged as mixed, since hole 7 at two courses is two different holes.
 */
export function holeCard(rounds: Round[], baseline: [number, number][]): { rows: HoleRow[]; mixed: boolean } | null {
  const rs = real(rounds).filter((r) => r.holes.some((h) => h.par !== undefined && h.strokes));
  if (!rs.length) return null;
  const mixed = new Set(rs.map((r) => courseKey(r.course ?? ''))).size > 1;
  const rows: HoleRow[] = [];
  for (let n = 1; n <= 18; n++) {
    const hs = rs.map((r) => r.holes.find((h) => h.hole === n)).filter((h) => h && h.par !== undefined && h.strokes);
    if (!hs.length) continue;
    const vp = hs.map((h) => h!.strokes! - h!.par!);
    const putted = hs.filter((h) => h!.putts.length);
    const makes = hs.flatMap((h) => h!.putts.filter((p) => p.made).map((p) => p.d));
    rows.push({
      hole: n,
      par: hs[0]!.par!,
      played: hs.length,
      avg: hs.reduce((a, h) => a + h!.strokes!, 0) / hs.length,
      toPar: vp.reduce((a, v) => a + v, 0) / vp.length,
      samePar: hs.every((h) => h!.par === hs[0]!.par),
      eagle: vp.filter((v) => v <= -2).length,
      birdie: vp.filter((v) => v === -1).length,
      pars: vp.filter((v) => v === 0).length,
      bogey: vp.filter((v) => v === 1).length,
      double: vp.filter((v) => v >= 2).length,
      sg: putted.length
        ? putted.reduce(
            (a, h) =>
              a +
              holeSG(
                baseline,
                h!.putts.map((p) => p.d),
                h!.putts.length,
              ),
            0,
          ) / putted.length
        : null,
      longestMake: makes.length ? Math.max(...makes) : null,
    });
  }
  return { rows, mixed };
}
