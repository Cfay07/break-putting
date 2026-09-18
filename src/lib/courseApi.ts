import type { SavedCourse, SavedTee } from './types';

const BASE = 'https://api.golfcourseapi.com/v1';
const KEY = 'Key 3VIUZUIXPFVAJPBAWNTJLGW7JQ';

export interface CourseHit {
  id: string;
  name: string;
  place: string;
}

interface ApiTee {
  tee_name?: string;
  total_yards?: number;
  holes?: { par?: number }[];
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: KEY } });
  if (res.status === 401) throw new Error('The API key was rejected.');
  if (!res.ok) throw new Error(`The course service answered ${res.status}.`);
  return res.json();
}

export async function searchCourses(query: string): Promise<CourseHit[]> {
  const data = (await get(`/search?search_query=${encodeURIComponent(query)}`)) as {
    courses?: { id: string; club_name?: string; course_name?: string; location?: { city?: string; state?: string } }[];
  };
  return (data.courses ?? []).map((c) => ({
    id: String(c.id),
    name: c.course_name && c.course_name !== c.club_name ? `${c.club_name} · ${c.course_name}` : (c.club_name ?? c.course_name ?? 'Unnamed'),
    place: [c.location?.city, c.location?.state].filter(Boolean).join(', '),
  }));
}

export async function loadCourse(id: string): Promise<SavedCourse> {
  const data = (await get(`/courses/${id}`)) as {
    course?: { club_name?: string; course_name?: string; location?: { city?: string; state?: string }; tees?: Record<string, ApiTee[]> };
  };
  const c = data.course ?? {};
  const tees: SavedTee[] = [];

  for (const group of Object.values(c.tees ?? {})) {
    for (const tee of group ?? []) {
      const pars = (tee.holes ?? []).map((h) => h.par ?? 4);
      if (!pars.length) continue;
      const name = tee.tee_name ?? 'Tee';
      if (tees.some((t) => t.name === name && t.yards === tee.total_yards)) continue;
      tees.push({ name, yards: tee.total_yards, pars });
    }
  }

  return {
    id: String(id),
    name: c.course_name && c.course_name !== c.club_name ? `${c.club_name} · ${c.course_name}` : (c.club_name ?? 'Unnamed'),
    place: [c.location?.city, c.location?.state].filter(Boolean).join(', '),
    tees: tees.sort((a, b) => (b.yards ?? 0) - (a.yards ?? 0)),
  };
}
