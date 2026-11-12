import { useEffect, useState } from 'react';
import { loadCourse } from './courseApi';
import { useApp } from './store';
import type { SavedCourse, SavedTee } from './types';

const tried = new Set<string>();
const fetched = new Map<string, SavedCourse>();

const unrated = (c: SavedCourse) => c.tees.some((t) => !t.rating || !t.slope);
const isApi = (id: string) => !id.startsWith('builtin-');

function withRatings(mine: SavedTee[], theirs: SavedTee[]): SavedTee[] {
  return mine.map((t) => {
    if (t.rating && t.slope) return t;
    const match = theirs.find((o) => o.name === t.name && o.yards === t.yards) ?? theirs.find((o) => o.name === t.name);
    return match?.rating && match.slope ? { ...t, rating: match.rating, slope: match.slope } : t;
  });
}

/**
 * Courses saved before ratings were kept get them filled in from the course service, once a
 * session each. Rounds on a course you since removed are looked up too, but not saved back.
 * Returns every course a round can be rated against.
 */
export function useCourseRatings(): SavedCourse[] {
  const { state, dispatch } = useApp();
  const [extra, setExtra] = useState<SavedCourse[]>(() => [...fetched.values()]);

  useEffect(() => {
    const saved = new Set(state.courses.map((c) => c.id));
    const missing = [
      ...state.courses.filter((c) => isApi(c.id) && unrated(c)).map((c) => c.id),
      ...new Set(state.rounds.map((r) => r.courseId).filter((id): id is string => !!id && isApi(id) && !saved.has(id))),
    ].filter((id) => !tried.has(id));
    if (!missing.length) return;
    missing.forEach((id) => tried.add(id));
    for (const id of missing) {
      loadCourse(id)
        .then((course) => {
          const mine = state.courses.find((c) => c.id === id);
          if (mine) {
            const tees = withRatings(mine.tees, course.tees);
            if (tees.some((t, i) => t !== mine.tees[i])) dispatch({ t: 'rateTees', id, tees });
          } else {
            fetched.set(id, course);
            setExtra([...fetched.values()]);
          }
        })
        .catch(() => undefined);
    }
  }, [state.courses, state.rounds, dispatch]);

  return [...state.courses, ...extra];
}
