import type { DrillDef, PracticeSet } from './types';
import { TEST_ID } from './weeklyTest';

/**
 * A drill that keeps pace with you. Your mark is the score you reach about two sets in three, so
 * wins come often enough to count. Clear it twice in a row and the app asks whether to move back a
 * foot; it never moves you on its own. The research behind it: learning is best when difficulty
 * sits just above what you can already do, and that point moves as you improve.
 */
export const LEVEL_STEP = 1;
const MARK_SETS = 10;
const MARK_NEED = 3;
/** After you choose to stay, how many more sets before it asks again. */
export const ASK_AGAIN_AFTER = 3;

export interface Level {
  ft: number;
  /** Sets at this distance before it may ask again. */
  askAfter?: number;
}

/** One distance, scored by count: the drills a foot back still means the same thing. */
export function levels(d: DrillDef): boolean {
  if (d.scoring !== 'count' || d.id === TEST_ID || d.shuffle || d.beat) return false;
  return new Set(d.stations.map((s) => s.d)).size === 1 && d.stations[0].d > 0;
}

export function withLevel<T extends DrillDef>(d: T, level: Level | undefined, room = Infinity): T {
  if (!level?.ft || !levels(d)) return d;
  return { ...d, stations: d.stations.map((s) => ({ ...s, d: Math.min(room, s.d + level.ft) })) };
}

/** Sets of this drill rolled at this distance, oldest first. */
export function setsAt(sets: PracticeSet[], family: string, familyOf: (id: string) => string, d: number): PracticeSet[] {
  return sets
    .filter((s) => familyOf(s.drill) === family && s.attempts > 0 && s.stations?.length && s.stations.every((st) => st.d === d))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.updated ?? '').localeCompare(b.updated ?? ''));
}

/** The score you reach or beat in about two of every three recent sets. */
export function markOf(scores: number[]): number | null {
  const recent = scores.slice(-MARK_SETS);
  if (recent.length < MARK_NEED) return null;
  const sorted = [...recent].sort((a, b) => a - b);
  return sorted[Math.floor(0.35 * (sorted.length - 1))];
}

/**
 * Your last two sets both cleared the mark you had before them, and you are past any "stay" you
 * chose. The mark comes from the sets ahead of those two, so the clears are judged fairly.
 */
export function readyToMove(scores: number[], level: Level | undefined): boolean {
  if (scores.length < 2) return false;
  const mark = markOf(scores.slice(0, -2));
  if (mark === null) return false;
  if (level?.askAfter !== undefined && scores.length < level.askAfter) return false;
  return scores.slice(-2).every((s) => s >= mark);
}
