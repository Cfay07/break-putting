import { useEffect, useState } from 'react';
import { currentSession, table } from './cloud';
import type { SavedCourse } from './types';

/**
 * Courses every player can find: typed in on any phone, or loaded once from the course service.
 * Kept on the phone after the first load, so search and ratings work offline and the list is
 * fetched once a session, not on every screen.
 */

const KEY = 'break.sharedCourses';
let shared: SavedCourse[] = read();
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function read(): SavedCourse[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedCourse[];
  } catch {
    return [];
  }
}

function keep(list: SavedCourse[]) {
  shared = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the list still holds for this session.
  }
  listeners.forEach((l) => l());
}

async function load() {
  if (!currentSession()) return;
  const res = await table('shared_courses?select=id,name,place,tees');
  if (!res.ok) return;
  const rows = (await res.json()) as { id: string; name: string; place: string | null; tees: SavedCourse['tees'] }[];
  keep(rows.map((r) => ({ id: r.id, name: r.name, ...(r.place ? { place: r.place } : {}), tees: r.tees })));
}

export function sharedCourses(): SavedCourse[] {
  return shared;
}

export function useSharedCourses(): SavedCourse[] {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    loading ??= load().catch(() => undefined);
    return () => void listeners.delete(l);
  }, []);
  return shared;
}

/**
 * Adds a course for everyone. One already there is left as it is: only whoever added a course
 * can change it, so a second copy never overwrites the first.
 */
export async function shareCourse(course: SavedCourse, source: 'typed' | 'service'): Promise<void> {
  if (!currentSession() || !course.tees.length || course.id.startsWith('builtin-')) return;
  if (shared.some((c) => c.id === course.id)) return;
  const res = await table('shared_courses', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ id: course.id, name: course.name, place: course.place ?? null, tees: course.tees, source }),
  }).catch(() => null);
  if (res?.ok) keep([...shared, course]);
}
