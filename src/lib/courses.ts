import { BUILT_IN_COURSES, NAMED_NINES, NINES_SEP, OLD_NINES_BOX } from './builtInCourses';
import type { Round, SavedCourse, SavedTee } from './types';

const STOP = new Set(['golf', 'club', 'course', 'links', 'country', 'gc', 'cc', 'the', 'at', 'of', 'and', '18', '9']);
export const words = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));

/** True when every word of the shorter name is in the longer one: "Ives Grove" is Ives Grove Golf Links. */
export function sameCourse(a: string, b: string): boolean {
  const [x, y] = [words(a), words(b)].sort((p, q) => p.length - q.length);
  return x.length > 0 && x.every((w) => y.includes(w));
}

const placeOf = (c: SavedCourse) => (c.place ?? '').toLowerCase().replace(/[^a-z,]/g, '');
// Two Shiloh Parks in Illinois: same name only counts as the same course in the same town.
const samePlace = (a: SavedCourse, b: SavedCourse) => !placeOf(a) || !placeOf(b) || placeOf(a) === placeOf(b);

const flatPlace = (p: string | undefined) => (p ?? '').toLowerCase().replace(/[^a-z,]/g, '');

/**
 * One row per course in a search. The course service can list a course the app already carries
 * under its own id (Shiloh Park, Vernon Hills), or list it twice itself. Same name and same town
 * is the same course; the first row, the one already on the phone or shared, stays.
 */
export function dedupeHits<T extends { id: string; name: string; place?: string }>(hits: T[]): T[] {
  const nameKey = (h: T) => `${words(h.name).join(' ')}|${flatPlace(h.place).split(',').pop()}`;
  // How many directory courses share a name in a state. Two Shiloh Parks in Illinois means the
  // name alone says nothing, and only the town can match.
  const inDirectory = new Map<string, number>();
  for (const h of hits)
    if (h.id.startsWith('oga-')) inDirectory.set(nameKey(h), (inDirectory.get(nameKey(h)) ?? 0) + 1);
  const out: T[] = [];
  for (const h of hits) {
    const i = out.findIndex((o) => {
      if (o.id === h.id) return true;
      const [a, b] = [flatPlace(o.place), flatPlace(h.place)];
      // With no town on one side, only exactly the same name is the same course.
      const sameName = words(o.name).join(' ') === words(h.name).join(' ');
      if (!a || !b) return sameName;
      // Directories disagree on towns (Ivanhoe or South Barrington), so an identical name in the
      // same state is the same course too.
      const stateOf = (p: string) => p.split(',').pop();
      const unique = (inDirectory.get(nameKey(h)) ?? 0) <= 1 && (inDirectory.get(nameKey(o)) ?? 0) <= 1;
      return (a === b && sameCourse(o.name, h.name)) || (sameName && unique && stateOf(a) === stateOf(b));
    });
    if (i < 0) out.push(h);
    // A course typed in with no town gives way to the same course with one, which has the tees.
    else if (!flatPlace(out[i].place) && flatPlace(h.place)) out[i] = h;
  }
  return out;
}

/**
 * One entry per real course. Saved, built-in and looked-up copies of the same course collapse
 * to the one with the most rated tees, so no course shows twice.
 */
export function dedupeCourses(courses: SavedCourse[]): SavedCourse[] {
  const rated = (c: SavedCourse) => c.tees.filter((t) => t.rating && t.slope).length * 100 + c.tees.length;
  const out: SavedCourse[] = [];
  for (const c of courses) {
    const i = out.findIndex((o) => o.id === c.id || (sameCourse(o.name, c.name) && samePlace(o, c)));
    if (i < 0) out.push(c);
    else if (rated(c) > rated(out[i])) out[i] = c;
  }
  return out;
}

const ratedCount = (c: SavedCourse) => c.tees.filter((t) => t.rating && t.slope).length;
const mostRated = (cs: SavedCourse[]) =>
  cs.reduce<SavedCourse | undefined>((best, c) => (!best || ratedCount(c) > ratedCount(best) ? c : best), undefined);

export function courseOf(round: Round, courses: SavedCourse[]): SavedCourse | undefined {
  const all = [...courses, ...BUILT_IN_COURSES];
  // The same course can be here twice: a copy saved before ratings were kept, and a shared one
  // with them. The one with the most rated tees wins.
  if (round.courseId) return mostRated(all.filter((c) => c.id === round.courseId));
  return round.course ? dedupeCourses(all).find((c) => sameCourse(c.name, round.course!)) : undefined;
}

export function teeOf(round: Round, courses: SavedCourse[]): SavedTee | undefined {
  if (!round.courseId || !round.tee) return undefined;
  return findTee(courseOf(round, courses), round.tee);
}

/** A tee by name. On a course built from nines, an old "Red/White" with no box is the Blue box. */
export function findTee(course: SavedCourse | undefined, name: string): SavedTee | undefined {
  if (!course) return undefined;
  const exact = course.tees.find((t) => t.name === name);
  if (exact || !NAMED_NINES.has(course.id) || name.includes(NINES_SEP)) return exact;
  return course.tees.find((t) => t.name === `${name}${NINES_SEP}${OLD_NINES_BOX}`);
}

/** A women's tee, by how the course service and the ratings backup label them. */
const womens = (t: SavedTee) => /\(W\)|women|ladies/i.test(t.name);

/**
 * The tee to count a round off when it never said which: the nines you played where the course
 * is built from nines (Ives Grove's "Red/White" is the tee), otherwise the longest rated men's tee.
 * Only for rounds with no tee at all; a tee you picked is never replaced.
 */
export function backTeeFor(round: Round, courses: SavedCourse[]): { course: SavedCourse; tee: SavedTee } | null {
  if (round.tee) return null;
  const course = courseOf(round, courses);
  if (!course) return null;
  const rated = course.tees.filter((t) => t.rating && t.slope && !womens(t));
  const nines = [round.firstNine, round.secondNine].filter(Boolean).join('/');
  const byNines = nines ? findTee({ ...course, tees: rated }, nines) : undefined;
  if (byNines) return { course, tee: byNines };
  const fits = rated.filter((t) => t.pars.length === round.holeCount);
  const back = [...(fits.length ? fits : rated)].sort((a, b) => (b.yards ?? 0) - (a.yards ?? 0))[0];
  return back ? { course, tee: back } : null;
}
