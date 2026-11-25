import { publicRead } from './cloud';
import { searchCourses, loadCourse } from './courseApi';
import { sameCourse } from './courses';
import type { SavedCourse, SavedTee } from './types';

/**
 * Every course in the states BREAK! players play, so search always finds the course without
 * spending the course service's small daily allowance. The directory knows names and towns; the
 * tees and ratings come when a player first opens a course, and are shared from then on.
 */

export interface DirectoryHit {
  id: string;
  name: string;
  place: string;
  holes: number | null;
}

const OGA = 'https://api.opengolfapi.org/v1';

export async function searchDirectory(query: string): Promise<DirectoryHit[]> {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (!words.length) return [];
  const all = words.map((w) => `name.ilike.*${encodeURIComponent(w)}*`).join(',');
  const res = await publicRead(`course_directory?and=(${all})&select=id,name,city,state,holes&order=name&limit=25`);
  if (!res.ok) return [];
  const rows = (await res.json()) as {
    id: string;
    name: string;
    city: string | null;
    state: string;
    holes: number | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    place: [r.city, r.state].filter(Boolean).join(', '),
    holes: r.holes,
  }));
}

interface OgTee {
  tee_name?: string;
  gender?: string;
  course_rating?: number | null;
  slope?: number | null;
  yardage?: number | null;
}

/** The open directory's own card, for a course the main course service does not have. */
async function fromDirectory(hit: DirectoryHit): Promise<SavedCourse | null> {
  const id = hit.id.replace(/^oga-/, '');
  const [card, teeData] = await Promise.all([
    fetch(`${OGA}/courses/${id}`).then((r) => (r.ok ? r.json() : null)),
    fetch(`${OGA}/courses/${id}/tees`).then((r) => (r.ok ? r.json() : null)),
  ]);
  const pars = ((card?.scorecard ?? []) as { hole: number; par: number }[])
    .sort((a, b) => a.hole - b.hole)
    .map((h) => h.par);
  if (pars.length !== 9 && pars.length !== 18) return null;
  const tees: SavedTee[] = [];
  for (const t of ((teeData?.tees ?? []) as OgTee[]).sort((a, b) => (b.yardage ?? 0) - (a.yardage ?? 0))) {
    const base = t.tee_name ?? 'Tee';
    const women = /female|women|ladies/i.test(t.gender ?? '');
    // A women's rating is always marked, so it never passes for a men's on the handicap.
    const name = women ? `${base} (W)` : base;
    if (tees.some((x) => x.name === name)) continue;
    const rated = (t.course_rating ?? 0) > 0 && (t.slope ?? 0) > 0;
    tees.push({
      name,
      pars,
      ...(t.yardage ? { yards: t.yardage } : {}),
      ...(rated ? { rating: t.course_rating!, slope: t.slope! } : {}),
    });
  }
  return { id: hit.id, name: hit.name, place: hit.place, tees: tees.length ? tees : [{ name: 'Pars', pars }] };
}

/**
 * A directory course made playable: tees and ratings from the main course service when it has
 * the course (its ratings matched BlueGolf where the open data's did not), else the open card.
 * Null when neither has a card, and the player types the pars in.
 */
export async function openDirectoryCourse(hit: DirectoryHit): Promise<SavedCourse | null> {
  const state = hit.place.split(',').pop()?.trim();
  try {
    const found = await searchCourses(hit.name);
    const match = found.find((f) => sameCourse(f.name, hit.name) && f.place.split(',').pop()?.trim() === state);
    if (match) {
      const course = await loadCourse(match.id);
      if (course.tees.length) return course;
    }
  } catch {
    // Over the daily limit or down: the open card below still works.
  }
  return fromDirectory(hit).catch(() => null);
}
