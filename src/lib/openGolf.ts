import type { SavedCourse, SavedTee } from './types';

/** Free, keyless backup for course ratings. 1,000 lookups a day per phone is plenty. */
const BASE = 'https://api.opengolfapi.org/v1';

interface OgTee {
  tee_name?: string;
  gender?: string;
  course_rating?: number | null;
  slope?: number | null;
  yardage?: number | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function json(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Ratings lookup answered ${res.status}.`);
  return res.json();
}

/**
 * Rated tees for a course, matched on name, state and town. The town matters: there are two
 * Shiloh Parks in Illinois and only one of them is the one you played.
 */
export async function ratedTees(course: SavedCourse): Promise<OgTee[]> {
  const [city, state] = (course.place ?? '').split(',').map((s) => s.trim());
  if (!state) return [];
  const name = course.name.split(' · ')[0];
  const found = (await json(`/courses/search?q=${encodeURIComponent(name)}&state=${encodeURIComponent(state)}&limit=5`)) as {
    courses?: { id: string; name?: string; city?: string }[];
  };
  const hit = (found.courses ?? []).find((c) => norm(c.city ?? '') === norm(city ?? '') && norm(c.name ?? '').includes(norm(name).slice(0, 8)));
  if (!hit) return [];
  const data = (await json(`/courses/${hit.id}/tees`)) as { tees?: OgTee[] };
  return (data.tees ?? []).filter((t) => (t.course_rating ?? 0) > 0 && (t.slope ?? 0) > 0);
}

/** Fill only the tees still missing a rating: same name, men's first, then the closest yardage. */
export function fillFrom(tees: SavedTee[], rated: OgTee[]): SavedTee[] {
  return tees.map((t) => {
    if (t.rating && t.slope) return t;
    const same = rated
      .filter((o) => norm(o.tee_name ?? '') === norm(t.name))
      .sort(
        (a, b) =>
          (a.gender === 'Male' ? 0 : 1) - (b.gender === 'Male' ? 0 : 1) ||
          Math.abs((a.yardage ?? 0) - (t.yards ?? 0)) - Math.abs((b.yardage ?? 0) - (t.yards ?? 0)),
      );
    const o = same[0];
    return o ? { ...t, rating: o.course_rating!, slope: o.slope! } : t;
  });
}
