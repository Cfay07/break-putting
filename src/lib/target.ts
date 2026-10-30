import type { Habit } from './habits';
import type { PracticePattern, Slice } from './pinpoint';
import type { ZoneRead } from './practice';
import { confidenceOf } from './sample';

/**
 * Six weeks without a round and your practice knows more about you than your rounds do. This is
 * the only thing winter changes, and it changes it the same way for a player in Florida who
 * stopped logging rounds.
 */
export const STALE_DAYS = 42;

export type TargetKind = 'slice' | 'zone' | 'habit' | 'practice' | 'test';

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

/**
 * The one thing the Practice tab leads with. Rounds name it when they can say something past
 * chance; your stroke habits next; then your own practice misses; and with nothing to go on, the
 * weekly test, which needs no data to be worth taking.
 */
export function targetKind(o: {
  zone: ZoneRead | null;
  slice: Slice | null;
  habit: Habit | null;
  pattern: PracticePattern | null;
  lastRound: string | null;
  today: string;
}): TargetKind {
  const stale = !o.lastRound || daysBetween(o.lastRound, o.today) > STALE_DAYS;
  if (o.pattern && stale) return 'practice';
  if (o.zone && confidenceOf(o.zone.sample) !== 'waiting' && o.zone.sgPerRound < 0) return o.slice ? 'slice' : 'zone';
  if (o.habit) return 'habit';
  if (o.pattern) return 'practice';
  return 'test';
}
