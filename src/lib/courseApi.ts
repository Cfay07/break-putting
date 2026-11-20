import { callFunction } from './cloud';
import type { SavedCourse, SavedTee } from './types';

export interface CourseHit {
  id: string;
  name: string;
  place: string;
}

interface ApiTee {
  tee_name?: string;
  total_yards?: number;
  course_rating?: number;
  slope_rating?: number;
  holes?: { par?: number }[];
}

/** Through the course-lookup function, which holds the course service's key so the app never does. */
async function get(params: Record<string, string>): Promise<unknown> {
  const res = await callFunction('course-lookup', params);
  if (!res.ok) throw new Error(`The course service answered ${res.status}.`);
  return res.json();
}

export async function searchCourses(query: string): Promise<CourseHit[]> {
  const data = (await get({ q: query })) as {
    courses?: { id: string; club_name?: string; course_name?: string; location?: { city?: string; state?: string } }[];
  };
  return (data.courses ?? []).map((c) => ({
    id: String(c.id),
    name:
      c.course_name && c.course_name !== c.club_name
        ? `${c.club_name} · ${c.course_name}`
        : (c.club_name ?? c.course_name ?? 'Unnamed'),
    place: [c.location?.city, c.location?.state].filter(Boolean).join(', '),
  }));
}

export async function loadCourse(id: string): Promise<SavedCourse> {
  const data = (await get({ id })) as {
    course?: {
      club_name?: string;
      course_name?: string;
      location?: { city?: string; state?: string };
      tees?: Record<string, ApiTee[]>;
    };
  };
  const c = data.course ?? {};
  const tees: SavedTee[] = [];

  // Men's first, so a tee listed for both keeps the men's rating.
  const groups = Object.entries(c.tees ?? {}).sort(([a], [b]) => (a === 'male' ? -1 : b === 'male' ? 1 : 0));
  for (const [, group] of groups) {
    for (const tee of group ?? []) {
      const pars = (tee.holes ?? []).map((h) => h.par ?? 4);
      if (!pars.length) continue;
      const base = tee.tee_name ?? 'Tee';
      if (tees.some((t) => t.name === base && t.yards === tee.total_yards)) continue;
      // A women's tee sharing a men's name but not its length is a different box: label it.
      const name = tees.some((t) => t.name === base) ? `${base} (W)` : base;
      const rated = (tee.course_rating ?? 0) > 0 && (tee.slope_rating ?? 0) > 0;
      tees.push({
        name,
        yards: tee.total_yards,
        pars,
        ...(rated ? { rating: tee.course_rating, slope: tee.slope_rating } : {}),
      });
    }
  }

  return {
    id: String(id),
    name:
      c.course_name && c.course_name !== c.club_name ? `${c.club_name} · ${c.course_name}` : (c.club_name ?? 'Unnamed'),
    place: [c.location?.city, c.location?.state].filter(Boolean).join(', '),
    tees: tees.sort((a, b) => (b.yards ?? 0) - (a.yards ?? 0)),
  };
}
