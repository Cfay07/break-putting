import { BUILT_IN_COURSES } from './builtInCourses';
import { bestOf, type PuttingHcp, type Scored } from './puttingHcp';
import type { Round, SavedCourse, SavedTee } from './types';

const STOP = new Set(['golf', 'club', 'course', 'links', 'country', 'gc', 'cc', 'the', 'at', 'of', 'and', '18', '9']);
export const words = (name: string) =>
  name.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

/** True when every word of the shorter name is in the longer one: "Ives Grove" is Ives Grove Golf Links. */
export function sameCourse(a: string, b: string): boolean {
  const [x, y] = [words(a), words(b)].sort((p, q) => p.length - q.length);
  return x.length > 0 && x.every((w) => y.includes(w));
}

function courseOf(round: Round, courses: SavedCourse[]): SavedCourse | undefined {
  const all = [...courses, ...BUILT_IN_COURSES];
  if (round.courseId) return all.find((c) => c.id === round.courseId);
  return round.course ? all.find((c) => sameCourse(c.name, round.course!)) : undefined;
}

export function teeOf(round: Round, courses: SavedCourse[]): SavedTee | undefined {
  if (!round.courseId || !round.tee) return undefined;
  return courseOf(round, courses)?.tees.find((t) => t.name === round.tee);
}

/** Middle of the yardages you play when the round says which tee, so a guess picks the box you use. */
function usualYards(rounds: Round[], courses: SavedCourse[]): number | null {
  const yards = rounds.flatMap((r) => {
    const t = teeOf(r, courses);
    return t?.yards && t.pars.length === 18 ? [t.yards] : [];
  });
  if (!yards.length) return null;
  yards.sort((a, b) => a - b);
  return yards[Math.floor(yards.length / 2)];
}

/**
 * The tee a round was played off. Imported rounds often carry only the course name, so the
 * nines are tried next, then the rated tee closest to your usual yardage, marked as a guess.
 */
export function ratedTeeOf(round: Round, courses: SavedCourse[], usual: number | null): { tee: SavedTee; guessed: boolean } | null {
  const known = teeOf(round, courses);
  if (known) return known.rating && known.slope ? { tee: known, guessed: false } : null;
  const course = courseOf(round, courses);
  if (!course) return null;
  const rated = course.tees.filter((t) => t.rating && t.slope);
  const named = round.tee ?? (round.firstNine && round.secondNine ? `${round.firstNine}/${round.secondNine}` : undefined);
  const exact = named && rated.find((t) => t.name === named);
  if (exact) return { tee: exact, guessed: false };
  if (!rated.length || usual === null) return null;
  const closest = [...rated].sort((a, b) => Math.abs((a.yards ?? 0) - usual) - Math.abs((b.yards ?? 0) - usual))[0];
  return { tee: closest, guessed: true };
}

/** Score and the rating it is measured against, for the holes actually played. */
function scored(round: Round, courses: SavedCourse[], usual: number | null) {
  const tee = ratedTeeOf(round, courses, usual)?.tee;
  if (!tee?.rating || !tee.slope) return null;
  const holes = round.holes.filter((h) => (h.strokes ?? 0) > 0);
  if (holes.length !== 9 && holes.length !== 18) return null;
  // A nine on an eighteen-hole rating is half of it, the usual stand-in when no nine-hole rating is published.
  const rating = (tee.rating * holes.length) / tee.pars.length;
  return { score: holes.reduce((a, h) => a + (h.strokes ?? 0), 0), rating, slope: tee.slope, nine: holes.length === 9 };
}

const diff = (score: number, rating: number, slope: number) => (113 / slope) * (score - rating);

/**
 * Each eighteen is (113 / slope) x (score - course rating). Two nines are added together first,
 * scores and ratings, with their slopes averaged. Then the same best 8 of the last 20
 * as the putting handicap, so the two line up.
 */
export function gameHcp(rounds: Round[], courses: SavedCourse[]): PuttingHcp | null {
  const real = rounds.filter((r) => r.finished && !r.practice).sort((a, b) => a.date.localeCompare(b.date));
  const usual = usualYards(real, courses);
  const out: Scored[] = [];
  let waiting: { id: string; s: NonNullable<ReturnType<typeof scored>> } | null = null;
  for (const r of real) {
    const s = scored(r, courses, usual);
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
/** Scored rounds that still cannot be rated, and ones rated off a guessed tee. */
export function ratingGaps(rounds: Round[], courses: SavedCourse[]): { unrated: number; guessed: number } {
  const real = rounds.filter((r) => r.finished && !r.practice && r.holes.some((h) => (h.strokes ?? 0) > 0));
  const usual = usualYards(real, courses);
  return {
    unrated: real.filter((r) => !scored(r, courses, usual)).length,
    guessed: real.filter((r) => ratedTeeOf(r, courses, usual)?.guessed).length,
  };
}
