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
  front_course_rating?: number;
  front_slope_rating?: number;
  holes?: { par?: number; yardage?: number }[];
}

/**
 * A nine-hole course the service lists as eighteen: the same nine twice, hole for hole, with an
 * eighteen-hole rating. Red Pine 9 at Brighton Dale is one. It is saved as the nine it is, with
 * the nine's own rating where the service gives one, else half the eighteen.
 */
export function asStraightNine(
  tee: ApiTee,
): { pars: number[]; yards?: number; rating?: number; slope?: number } | null {
  const holes = tee.holes ?? [];
  if (holes.length !== 18) return null;
  const same = holes.slice(0, 9).every((h, i) => h.par === holes[i + 9].par && h.yardage === holes[i + 9].yardage);
  if (!same || !holes[0].yardage) return null;
  const rated = (tee.course_rating ?? 0) > 0 && (tee.slope_rating ?? 0) > 0;
  return {
    pars: holes.slice(0, 9).map((h) => h.par ?? 4),
    yards: holes.slice(0, 9).reduce((a, h) => a + (h.yardage ?? 0), 0),
    ...(rated
      ? {
          rating: (tee.front_course_rating ?? 0) > 0 ? tee.front_course_rating : tee.course_rating! / 2,
          slope: (tee.front_slope_rating ?? 0) > 0 ? tee.front_slope_rating : tee.slope_rating,
        }
      : {}),
  };
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
      const nine = asStraightNine(tee);
      const yards = nine ? nine.yards : tee.total_yards;
      if (tees.some((t) => t.name === base && t.yards === yards)) continue;
      // A women's tee sharing a men's name but not its length is a different box: label it.
      const name = tees.some((t) => t.name === base) ? `${base} (W)` : base;
      const rated = (tee.course_rating ?? 0) > 0 && (tee.slope_rating ?? 0) > 0;
      tees.push(
        nine
          ? { name, ...nine }
          : {
              name,
              yards,
              pars,
              ...(rated ? { rating: tee.course_rating, slope: tee.slope_rating } : {}),
            },
      );
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
