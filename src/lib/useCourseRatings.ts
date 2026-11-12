import { useEffect, useState } from 'react';
import { BUILT_IN_COURSES } from './builtInCourses';
import { loadCourse } from './courseApi';
import { fillFrom, ratedTees } from './openGolf';
import { useApp } from './store';
import type { SavedCourse, SavedTee } from './types';

const tried = new Set<string>();
const fetched = new Map<string, SavedCourse>();

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
  const [extra, setExtra] = useState<SavedCourse[]>(() => [...fetched.values()]);

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
          fetched.set(id, { ...course, tees });
          setExtra([...fetched.values()]);
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
            fetched.set(course.id, { ...course, tees });
            setExtra([...fetched.values()]);
          }
        })
        .catch(() => undefined);
    }
  }, [state.courses, state.rounds, dispatch]);

  return [...state.courses, ...extra];
}
