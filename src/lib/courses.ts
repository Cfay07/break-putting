import { BUILT_IN_COURSES } from './builtInCourses';
import type { Round, SavedCourse, SavedTee } from './types';

const STOP = new Set(['golf', 'club', 'course', 'links', 'country', 'gc', 'cc', 'the', 'at', 'of', 'and', '18', '9']);
export const words = (name: string) =>
  name.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

/** True when every word of the shorter name is in the longer one: "Ives Grove" is Ives Grove Golf Links. */
export function sameCourse(a: string, b: string): boolean {
  const [x, y] = [words(a), words(b)].sort((p, q) => p.length - q.length);
  return x.length > 0 && x.every((w) => y.includes(w));
}

const placeOf = (c: SavedCourse) => (c.place ?? '').toLowerCase().replace(/[^a-z,]/g, '');
// Two Shiloh Parks in Illinois: same name only counts as the same course in the same town.
const samePlace = (a: SavedCourse, b: SavedCourse) => !placeOf(a) || !placeOf(b) || placeOf(a) === placeOf(b);

/**
 * One entry per real course. Saved, built-in and looked-up copies of the same course collapse
 * to the one with the most rated tees, so no course shows twice.
 */
export function dedupeCourses(courses: SavedCourse[]): SavedCourse[] {
  const rated = (c: SavedCourse) => c.tees.filter((t) => t.rating && t.slope).length * 100 + c.tees.length;
  const out: SavedCourse[] = [];
  for (const c of courses) {
    const i = out.findIndex(
      (o) => o.id === c.id || (sameCourse(o.name, c.name) && samePlace(o, c)),
    );
    if (i < 0) out.push(c);
    else if (rated(c) > rated(out[i])) out[i] = c;
  }
  return out;
}

function courseOf(round: Round, courses: SavedCourse[]): SavedCourse | undefined {
  const all = [...courses, ...BUILT_IN_COURSES];
  if (round.courseId) return all.find((c) => c.id === round.courseId);
  return round.course ? dedupeCourses(all).find((c) => sameCourse(c.name, round.course!)) : undefined;
}

export function teeOf(round: Round, courses: SavedCourse[]): SavedTee | undefined {
  if (!round.courseId || !round.tee) return undefined;
  return courseOf(round, courses)?.tees.find((t) => t.name === round.tee);
}
