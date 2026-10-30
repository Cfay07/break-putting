import { playAt, type Tally2 } from './practice';
import type { Hand, PracticeSet, Round } from './types';

export interface HandRow {
  d: number;
  left: Tally2;
  right: Tally2;
  /** Both hands, the normal way, from the same distance. */
  both: Tally2;
  play: Tally2;
}

const zero = (): Tally2 => ({ made: 0, attempts: 0 });
const add = (a: Tally2, b: Tally2) => ({ made: a.made + b.made, attempts: a.attempts + b.attempts });

/**
 * One-handed makes beside two-handed ones and the course, at every distance a one-handed
 * putt was rolled from. Holes only: a one-handed drill is a stroke drill, not a pace one.
 */
export function handsOf(sets: PracticeSet[], rounds: Round[]): { rows: HandRow[]; total: Omit<HandRow, 'd'> } {
  const at = new Map<number, HandRow>();
  const row = (d: number) => at.get(d) ?? { d, left: zero(), right: zero(), both: zero(), play: zero() };
  for (const s of sets) for (const st of s.stations ?? []) if (st.mode === 'make' && st.hand) at.set(st.d, row(st.d));
  for (const s of sets) {
    for (const st of s.stations ?? []) {
      if (st.mode !== 'make' || !at.has(st.d)) continue;
      const r = at.get(st.d)!;
      const key = st.hand ?? 'both';
      r[key] = add(r[key], st);
    }
  }
  const rows = [...at.values()].sort((a, b) => a.d - b.d).map((r) => ({ ...r, play: playAt(rounds, r.d, 'make') }));
  const total = rows.reduce(
    (t, r) => ({ left: add(t.left, r.left), right: add(t.right, r.right), both: add(t.both, r.both), play: add(t.play, r.play) }),
    { left: zero(), right: zero(), both: zero(), play: zero() },
  );
  return { rows, total };
}

/** Balls each hand needs before the two can be compared. */
export const HAND_NEED = 20;

export interface HandGap {
  verdict: Hand | 'even' | 'waiting';
  /** Left share minus right share, in points. */
  diff: number;
  margin: number;
}

/** Which hand is better, only when the difference is bigger than chance alone would make it. */
export function handGap(left: Tally2, right: Tally2): HandGap {
  if (left.attempts < HAND_NEED || right.attempts < HAND_NEED) return { verdict: 'waiting', diff: 0, margin: 0 };
  const p1 = left.made / left.attempts;
  const p2 = right.made / right.attempts;
  const diff = (p1 - p2) * 100;
  const margin = 196 * Math.sqrt((p1 * (1 - p1)) / left.attempts + (p2 * (1 - p2)) / right.attempts);
  return { verdict: diff > margin ? 'left' : diff < -margin ? 'right' : 'even', diff, margin };
}

/** Weeks needed, each with both one-hand practice and rounds, before a link is worth a number. */
export const LINK_WEEKS = 8;
const WEEK_BALLS = 10;
const WEEK_PUTTS = 10;

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export interface HandLink {
  weeks: number;
  /** Pearson's r across those weeks, once there are enough of them. */
  r: number | null;
}

/**
 * Does a good week with one hand go with a good week on the course? Week by week, the hand's
 * make rate against the course make rate from 3 to 8 feet. It can only ever say they move
 * together; a week you putt well is a week you putt well with everything.
 */
export function handLink(sets: PracticeSet[], rounds: Round[], hand: Hand): HandLink {
  const practice = new Map<string, Tally2>();
  for (const s of sets) {
    for (const st of s.stations ?? []) {
      if (st.hand !== hand || st.mode !== 'make') continue;
      const k = mondayOf(s.date);
      practice.set(k, add(practice.get(k) ?? zero(), st));
    }
  }
  const course = new Map<string, Tally2>();
  for (const r of rounds) {
    const k = mondayOf(r.date);
    let t = course.get(k) ?? zero();
    for (const h of r.holes) for (const p of h.putts) if (p.d >= 3 && p.d <= 8) t = add(t, { made: p.made ? 1 : 0, attempts: 1 });
    course.set(k, t);
  }
  const pairs = [...practice.entries()]
    .filter(([k, t]) => t.attempts >= WEEK_BALLS && (course.get(k)?.attempts ?? 0) >= WEEK_PUTTS)
    .map(([k, t]) => [t.made / t.attempts, course.get(k)!.made / course.get(k)!.attempts] as const);
  if (pairs.length < LINK_WEEKS) return { weeks: pairs.length, r: null };
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return { weeks: n, r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 };
}
