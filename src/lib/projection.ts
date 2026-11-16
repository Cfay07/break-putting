import { holeVsPar, holedOut, type Hole, type Round } from './types';

export interface LiveProjection {
  putts: number;
  /** Against par for the whole round, when every played hole has a score. */
  toPar: number | null;
  /** A number only when the course gives a par for every hole left. */
  score: number | null;
}

/** Holes before a projection is shown. Two holes of a round say almost nothing. */
export const PROJECT_FROM = 3;

/**
 * Nine holes of season history weigh the same as nine holes of today. Early in the round the
 * season number does most of the work; by the back nine today's pace has caught up.
 */
const SEASON_WEIGHT_HOLES = 9;

/** The last twenty rounds: recent enough to be this player now, long enough to be steady. */
const HISTORY_ROUNDS = 20;

const played = (h: Hole) => h.putts.length > 0 || holedOut(h);

function blend(pace: number, thru: number, season: number | null): number {
  if (season === null) return pace;
  const w = thru / (thru + SEASON_WEIGHT_HOLES);
  return w * pace + (1 - w) * season;
}

/**
 * Where a live round is heading: what has happened so far, plus the holes left at a rate that
 * blends this round's pace with the player's own recent rounds.
 */
export function liveProjection(live: Round, done: Round[]): LiveProjection | null {
  const holes = live.holes.filter((h) => h.hole <= live.holeCount);
  const so = holes.filter(played);
  const thru = so.length;
  const left = holes.filter((h) => !played(h));
  const remaining = live.holeCount - thru;
  if (thru < PROJECT_FROM || remaining <= 0) return null;

  const recent = [...done]
    .filter((r) => r.finished && r.id !== live.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, HISTORY_ROUNDS);
  const pastHoles = recent.flatMap((r) => r.holes.filter(played));

  const puttsSoFar = so.reduce((a, h) => a + h.putts.length, 0);
  const seasonPutts = pastHoles.length ? pastHoles.reduce((a, h) => a + h.putts.length, 0) / pastHoles.length : null;
  const putts = Math.round(puttsSoFar + remaining * blend(puttsSoFar / thru, thru, seasonPutts));

  const scored = so.filter((h) => holeVsPar(h) !== undefined);
  let toPar: number | null = null;
  let score: number | null = null;
  if (scored.length === thru) {
    const toParSoFar = scored.reduce((a, h) => a + holeVsPar(h)!, 0);
    const pastScored = pastHoles.filter((h) => holeVsPar(h) !== undefined);
    const seasonToPar = pastScored.length
      ? pastScored.reduce((a, h) => a + holeVsPar(h)!, 0) / pastScored.length
      : null;
    toPar = Math.round(toParSoFar + remaining * blend(toParSoFar / thru, thru, seasonToPar));
    const parLeft = left.length === remaining && left.every((h) => h.par !== undefined);
    const parPlayed = so.every((h) => h.par !== undefined);
    if (parLeft && parPlayed) {
      const par = holes.reduce((a, h) => a + h.par!, 0);
      score = par + toPar;
    }
  }
  return { putts, toPar, score };
}
