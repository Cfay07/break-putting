import { useEffect, useState } from 'react';
import { BUILT_IN_COURSES } from './builtInCourses';
import { loadCourse, searchCourses } from './courseApi';
import { sameCourse, words } from './gameHcp';
import { fillFrom, ratedTees } from './openGolf';
import { useApp } from './store';
import type { SavedCourse, SavedTee } from './types';

const tried = new Set<string>();
const fetched = new Map<string, SavedCourse>();
const listeners = new Set<() => void>();
const publish = (course: SavedCourse) => {
  fetched.set(course.id, course);
  listeners.forEach((l) => l());
};

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The course service throttles bursts, so space searches out and try once more after a wait. */
async function gentleSearch(q: string) {
  await pause(700);
  return searchCourses(q).catch(async () => {
    await pause(2500);
    return searchCourses(q).catch(() => []);
  });
}

const unrated = (tees: SavedTee[]) => tees.some((t) => !t.rating || !t.slope);
const isBuiltIn = (id: string) => id.startsWith('builtin-');

function withRatings(mine: SavedTee[], theirs: SavedTee[]): SavedTee[] {
  return mine.map((t) => {
    if (t.rating && t.slope) return t;
    const match = theirs.find((o) => o.name === t.name && o.yards === t.yards) ?? theirs.find((o) => o.name === t.name);
    return match?.rating && match.slope ? { ...t, rating: match.rating, slope: match.slope } : t;
  });
}

/** The course service first, then the free ratings lookup for whatever tees it left blank. */
async function rate(course: SavedCourse): Promise<SavedTee[]> {
  let tees = course.tees;
  if (!isBuiltIn(course.id)) tees = withRatings(tees, (await loadCourse(course.id)).tees);
  if (unrated(tees)) tees = fillFrom(tees, await ratedTees(course).catch(() => []));
  return tees;
}

/**
 * Courses saved before ratings were kept get them filled in, once a session each. Rounds on a
 * course you since removed, and built-in courses, are rated too but not saved back.
 * Returns every course a round can be rated against.
 */
export function useCourseRatings(): SavedCourse[] {
  const { state, dispatch } = useApp();
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  useEffect(() => {
    const saved = new Set(state.courses.map((c) => c.id));
    const played = new Set(state.rounds.map((r) => r.courseId).filter((id): id is string => !!id));
    const todo: { course: SavedCourse; mine: boolean }[] = [
      ...state.courses.filter((c) => unrated(c.tees) && !isBuiltIn(c.id)).map((course) => ({ course, mine: true })),
      ...BUILT_IN_COURSES.filter((c) => played.has(c.id) && unrated(c.tees)).map((course) => ({ course, mine: false })),
    ];
    const unsaved = [...played].filter((id) => !saved.has(id) && !isBuiltIn(id) && !tried.has(id));
    for (const id of unsaved) {
      tried.add(id);
      loadCourse(id)
        .then(async (course) => {
          const tees = unrated(course.tees) ? fillFrom(course.tees, await ratedTees(course).catch(() => [])) : course.tees;
          publish({ ...course, tees });
        })
        .catch(() => undefined);
    }
    for (const { course, mine } of todo) {
      if (tried.has(course.id)) continue;
      tried.add(course.id);
      rate(course)
        .then((tees) => {
          if (!tees.some((t, i) => t !== course.tees[i])) return;
          if (mine) dispatch({ t: 'rateTees', id: course.id, tees });
          else {
            publish({ ...course, tees });
          }
        })
        .catch(() => undefined);
    }

    // Imported rounds carry a course name and nothing else. Look the course up by name, only
    // in states you already play, so a Meadowbrook three states away is never picked.
    const known = [...state.courses, ...BUILT_IN_COURSES, ...fetched.values()];
    const states = new Set(known.map((c) => c.place?.split(',').pop()?.trim()).filter(Boolean));
    const names = new Set(
      state.rounds
        .filter((r) => !r.courseId && r.course && !known.some((c) => sameCourse(c.name, r.course!)))
        .map((r) => r.course!),
    );
    const fresh = [...names].filter((name) => !tried.has(`name:${name}`));
    fresh.forEach((name) => tried.add(`name:${name}`));
    // One at a time: the course service throttles a burst of searches.
    void (async () => {
      for (const name of fresh) {
        // "White Birch-Brighton Dale Links" is listed as "Brighton Dale Links · White Birch 18", so
        // try the whole name, then each half, then the bare words, until a hit names the same course.
        const queries = [...new Set([name.replace(/-/g, ' '), ...name.split('-').map((p) => p.trim()), words(name).join(' ')])];
        for (const q of queries) {
          const hits = await gentleSearch(q);
          const hit = hits.find((h) => sameCourse(h.name, name) && states.has(h.place.split(',').pop()?.trim()));
          if (!hit) continue;
          const course = await loadCourse(hit.id).catch(() => null);
          if (!course) break;
          const tees = unrated(course.tees) ? fillFrom(course.tees, await ratedTees(course).catch(() => [])) : course.tees;
          publish({ ...course, tees });
          break;
        }
      }
    })();
  }, [state.courses, state.rounds, dispatch]);

  return [...state.courses, ...fetched.values()];
}
