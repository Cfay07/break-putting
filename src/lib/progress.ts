import { roundSG } from './sg';
import { holedOut, type PracticeSet, type Round } from './types';
import { weekOf } from './weeklyTest';

/**
 * Is practice paying off. Every answer compares a recent window with the stretch before it and
 * only calls a change when it is bigger than the player's own normal swing, the way sports
 * science reads an athlete's tests (typical error, smallest worthwhile change). Without enough
 * on both sides it says so and how much more it needs, instead of guessing.
 */
export type Verdict = 'better' | 'probably-better' | 'holding' | 'probably-worse' | 'worse' | 'early';

export interface Compare {
  verdict: Verdict;
  recent: number | null;
  before: number | null;
  /** Typical swing between one value and the next, from all of them. */
  swing: number | null;
  /** More values needed before it can say anything. */
  need: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

export function compare(recent: number[], before: number[], minRecent = 2, minBefore = 3): Compare {
  const need = Math.max(0, minRecent - recent.length) + Math.max(0, minBefore - before.length);
  if (need > 0) {
    return { verdict: 'early', recent: recent.length ? mean(recent) : null, before: before.length ? mean(before) : null, swing: null, need };
  }
  const swing = sd([...before.map((x) => x - mean(before)), ...recent.map((x) => x - mean(recent))]) || 1e-9;
  const diff = mean(recent) - mean(before);
  const z = diff / (swing * Math.sqrt(1 / recent.length + 1 / before.length));
  const verdict: Verdict = z >= 1.645 ? 'better' : z >= 0.84 ? 'probably-better' : z <= -1.645 ? 'worse' : z <= -0.84 ? 'probably-worse' : 'holding';
  return { verdict, recent: mean(recent), before: mean(before), swing, need: 0 };
}

const daysBetween = (a: string, b: string) => (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5;

/** Recent is the last four weeks; before is the eight weeks ahead of that. Older work has moved on. */
export const RECENT_DAYS = 28;
export const BEFORE_DAYS = 84;

export function windows<T extends { date: string }>(items: T[], today: string) {
  const age = (x: T) => daysBetween(x.date, today);
  const recent = items.filter((x) => age(x) >= 0 && age(x) < RECENT_DAYS);
  const before = items.filter((x) => age(x) >= RECENT_DAYS && age(x) < BEFORE_DAYS);
  // A new player should not have to wait for weeks to age: with five results, the last two go
  // against everything before them.
  const sorted = [...items].filter((x) => age(x) >= 0 && age(x) < BEFORE_DAYS).sort((a, b) => a.date.localeCompare(b.date));
  if ((recent.length < 2 || before.length < 3) && sorted.length >= 5) {
    return { recent: sorted.slice(-2), before: sorted.slice(0, -2) };
  }
  return { recent, before };
}

export const rate = (s: PracticeSet) => s.made / Math.max(1, s.attempts);

/** The weeks you practiced at all, newest last, for the strip on the card. */
export function practiceWeeks(dates: string[], today: string, weeks = 8): boolean[] {
  const set = new Set(dates.map(weekOf));
  const start = new Date(`${weekOf(today)}T12:00:00Z`);
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1 - i));
    return set.has(d.toISOString().slice(0, 10));
  });
}

export const per18 = (r: Round, baseline: [number, number][]) => {
  const holes = r.holes.filter((h) => h.putts.length > 0 || holedOut(h)).length;
  return holes ? (roundSG(r, baseline) * 18) / holes : 0;
};

/** Rounds played within a week after practising, against the rest. What happened, not why. */
export function practiceSplit(rounds: Round[], practiceDates: string[], baseline: [number, number][]) {
  const after: number[] = [];
  const without: number[] = [];
  for (const r of rounds) {
    const near = practiceDates.some((d) => {
      const gap = daysBetween(d, r.date);
      return gap > 0 && gap <= 7;
    });
    (near ? after : without).push(per18(r, baseline));
  }
  return { after, without, compare: compare(after, without, 3, 3) };
}

export type Status = 'paying' | 'steady' | 'not-yet' | 'slipping' | 'baseline';

export const STATUS_WORD: Record<Status, string> = {
  paying: 'Paying off',
  steady: 'Holding steady',
  'not-yet': 'Not paying off yet',
  slipping: 'Slipping',
  baseline: 'Building a baseline',
};

/**
 * Like a training status: what you put in, read against what came out. Practising and better is
 * paying off; practising and holding is steady; practising and worse is not paying off yet; not
 * practising and worse is slipping.
 */
export function statusOf(practicedRecently: boolean, outcome: Verdict | null): Status {
  if (!outcome || outcome === 'early') return 'baseline';
  const up = outcome === 'better' || outcome === 'probably-better';
  const down = outcome === 'worse' || outcome === 'probably-worse';
  if (practicedRecently) return up ? 'paying' : down ? 'not-yet' : 'steady';
  return down ? 'slipping' : 'steady';
}
