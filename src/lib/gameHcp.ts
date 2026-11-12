import { BUILT_IN_COURSES } from './builtInCourses';
import { bestOf, type PuttingHcp, type Scored } from './puttingHcp';
import type { Round, SavedCourse, SavedTee } from './types';

const MAX_INDEX = 54;

export function teeOf(round: Round, courses: SavedCourse[]): SavedTee | undefined {
  if (!round.courseId || !round.tee) return undefined;
  const course = courses.find((c) => c.id === round.courseId) ?? BUILT_IN_COURSES.find((c) => c.id === round.courseId);
  return course?.tees.find((t) => t.name === round.tee);
}

/** Score and the rating it is measured against, for the holes actually played. */
function scored(round: Round, courses: SavedCourse[]) {
  const tee = teeOf(round, courses);
  if (!tee?.rating || !tee.slope) return null;
  const holes = round.holes.filter((h) => (h.strokes ?? 0) > 0);
  if (holes.length !== 9 && holes.length !== 18) return null;
  // A nine on an eighteen-hole rating is half of it, the usual stand-in when no nine-hole rating is published.
  const rating = (tee.rating * holes.length) / tee.pars.length;
  return { score: holes.reduce((a, h) => a + (h.strokes ?? 0), 0), rating, slope: tee.slope, nine: holes.length === 9 };
}

const diff = (score: number, rating: number, slope: number) =>
  Math.max(-10, Math.min(MAX_INDEX, (113 / slope) * (score - rating)));

/**
 * Each eighteen is (113 / slope) x (score - course rating). Two nines are added together first,
 * scores and ratings, with their slopes averaged. Then the same best 4 of the last 12
 * as the putting handicap, so the two line up.
 */
export function gameHcp(rounds: Round[], courses: SavedCourse[]): PuttingHcp | null {
  const real = rounds.filter((r) => r.finished && !r.practice).sort((a, b) => a.date.localeCompare(b.date));
  const out: Scored[] = [];
  let waiting: { id: string; s: NonNullable<ReturnType<typeof scored>> } | null = null;
  for (const r of real) {
    const s = scored(r, courses);
    if (!s) continue;
    if (!s.nine) out.push({ id: r.id, date: r.date, nines: false, hcp: diff(s.score, s.rating, s.slope) });
    else if (waiting) {
      const w = waiting.s;
      out.push({
        id: `${waiting.id}+${r.id}`,
        date: r.date,
        nines: true,
        hcp: diff(w.score + s.score, w.rating + s.rating, (w.slope + s.slope) / 2),
      });
      waiting = null;
    } else waiting = { id: r.id, s };
  }
  return bestOf(out);
}

/** Rounds with a score but no rated tee, so they cannot count yet. */
export function unrated(rounds: Round[], courses: SavedCourse[]): number {
  return rounds.filter((r) => r.finished && !r.practice && r.holes.some((h) => (h.strokes ?? 0) > 0) && !scored(r, courses)).length;
}
