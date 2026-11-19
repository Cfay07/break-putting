import { teeOf } from './courses';
import type { Round, SavedCourse } from './types';

/**
 * An ordinary handicap index, the way the World Handicap System works it out, from rounds whose
 * tee and its rating are known. No tee is guessed: a round that does not say which tee it was
 * played off does not count, which is what made the old version read skewed.
 *
 * - Each hole is capped at double bogey (the usual simple form of net double bogey).
 * - Differential = (113 / slope) x (adjusted score - course rating).
 * - Two nines played one after another combine into one eighteen.
 * - The index averages your lowest differentials from the last 20, with the standard table below
 *   when there are fewer than 20, rounded to a tenth.
 *
 * It is an estimate from what you logged, not an official index.
 */

export interface Differential {
  /** The round, or both nines joined by "+". */
  id: string;
  date: string;
  value: number;
  nines: boolean;
}

/** How many of the lowest to average, and the adjustment, by how many scores there are. */
const TABLE: [number, number, number][] = [
  // [scores up to, lowest to use, adjustment]
  [3, 1, -2],
  [4, 1, -1],
  [5, 1, 0],
  [6, 2, -1],
  [8, 2, 0],
  [11, 3, 0],
  [14, 4, 0],
  [16, 5, 0],
  [18, 6, 0],
  [19, 7, 0],
  [20, 8, 0],
];

export const MIN_SCORES = 3;
const WINDOW = 20;

/** Score for the holes played with each capped at double bogey, and the rating to measure it against. */
function adjusted(round: Round, courses: SavedCourse[]) {
  const tee = teeOf(round, courses);
  if (!tee?.rating || !tee.slope) return null;
  const holes = round.holes.filter((h) => (h.strokes ?? 0) > 0);
  if (holes.length !== 9 && holes.length !== 18) return null;
  if (holes.some((h) => h.par === undefined)) return null;
  const score = holes.reduce((a, h) => a + Math.min(h.strokes!, h.par! + 2), 0);
  // A nine off an eighteen-hole tee rates at half of it; a nine-hole tee is already rated for nine.
  const rating = tee.pars.length === holes.length ? tee.rating : (tee.rating * holes.length) / tee.pars.length;
  return { score, rating, slope: tee.slope, nine: holes.length === 9 };
}

const diff = (score: number, rating: number, slope: number) => (113 / slope) * (score - rating);

/** Every score that counts, oldest first. Nines pair with the next nine played. */
export function differentials(rounds: Round[], courses: SavedCourse[]): Differential[] {
  const real = rounds.filter((r) => r.finished && !r.practice).sort((a, b) => a.date.localeCompare(b.date));
  const out: Differential[] = [];
  let waiting: { id: string; a: NonNullable<ReturnType<typeof adjusted>> } | null = null;
  for (const r of real) {
    const a = adjusted(r, courses);
    if (!a) continue;
    if (!a.nine) {
      out.push({ id: r.id, date: r.date, value: diff(a.score, a.rating, a.slope), nines: false });
    } else if (waiting) {
      const w = waiting.a;
      out.push({
        id: `${waiting.id}+${r.id}`,
        date: r.date,
        value: diff(w.score + a.score, w.rating + a.rating, (w.slope + a.slope) / 2),
        nines: true,
      });
      waiting = null;
    } else waiting = { id: r.id, a };
  }
  return out;
}

/** The index from a run of differentials, oldest first. Null under three scores. */
export function indexOf(diffs: Differential[]): number | null {
  const last = diffs.slice(-WINDOW);
  if (last.length < MIN_SCORES) return null;
  const [, use, adj] = TABLE.find(([upTo]) => last.length <= upTo)!;
  const lowest = [...last].sort((a, b) => a.value - b.value).slice(0, use);
  const avg = lowest.reduce((a, d) => a + d.value, 0) / lowest.length + adj;
  return Math.round(avg * 10) / 10;
}

/** The index after every score, for the trend: what your handicap was on each date. */
/**
 * Under eight scores the system leans on your one or two best days with a cushion taken off, so an
 * early index reads far lower than you play. The trend starts at eight, where it settles.
 */
export const TREND_FROM = 8;

/** The index after one score, and the score that moved it: its round (or both nines) and differential. */
export interface HistoryPoint {
  date: string;
  index: number;
  scores: number;
  id: string;
  diff: number;
}

export function indexHistory(rounds: Round[], courses: SavedCourse[]): HistoryPoint[] {
  const diffs = differentials(rounds, courses);
  const out: HistoryPoint[] = [];
  diffs.forEach((d, i) => {
    const idx = indexOf(diffs.slice(0, i + 1));
    if (idx !== null) out.push({ date: d.date, index: idx, scores: Math.min(i + 1, WINDOW), id: d.id, diff: d.value });
  });
  return out;
}

/** Your index as it stood once this round was in. Null when it does not count or there are too few. */
export function indexAt(round: Round, rounds: Round[], courses: SavedCourse[]): number | null {
  const diffs = differentials(rounds, courses);
  const i = diffs.findIndex((d) => d.id === round.id || d.id.split('+').includes(round.id));
  if (i < 0) {
    // A round that does not count still shows the index as it stood on that day.
    const before = diffs.filter((d) => d.date <= round.date);
    return indexOf(before);
  }
  return indexOf(diffs.slice(0, i + 1));
}

/** Plain format: "4.8", or "+1.2" for better than scratch. */
export const fmtIndex = (v: number) => (v < 0 ? `+${Math.abs(v).toFixed(1)}` : v.toFixed(1));

/** How far this round moved your handicap, in tenths. Negative is better. Null if it did not count. */
export function indexMove(round: Round, rounds: Round[], courses: SavedCourse[]): number | null {
  const diffs = differentials(rounds, courses);
  const i = diffs.findIndex((d) => d.id === round.id || d.id.split('+').includes(round.id));
  if (i < 1) return null;
  const now = indexOf(diffs.slice(0, i + 1));
  const before = indexOf(diffs.slice(0, i));
  if (now === null || before === null) return null;
  return Math.round((now - before) * 10) / 10;
}
