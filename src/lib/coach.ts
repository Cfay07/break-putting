import { expectedPutts } from './sg';
import type { TeamPracticeRow } from './feed';
import type { FocusBand } from './starters';
import type { PlayerStats, TeamRound } from './teams';

/** Where a hole's first putt started. A three-putt from 40 feet is a 40-foot problem. */
export const COACH_BANDS: { key: FocusBand; label: string; max: number }[] = [
  { key: 'short', label: 'Inside 6 ft', max: 5 },
  { key: 'mid', label: '6 to 10 ft', max: 10 },
  { key: 'makeable', label: '11 to 20 ft', max: 20 },
  { key: 'lag', label: '21 to 40 ft', max: 40 },
  { key: 'long', label: 'Over 40 ft', max: Infinity },
];

const bandOf = (d: number) => COACH_BANDS.find((b) => d <= b.max)!.key;

/** Two rounds' worth of holes before the team gets a leak, and one round before a player does. */
const TEAM_MIN_HOLES = 36;
const PLAYER_MIN_HOLES = 18;

export interface Leak {
  /** Strokes against the baseline per 18 holes, by band. Negative is lost. */
  bands: { key: FocusBand; label: string; per18: number }[];
  worst: { key: FocusBand; label: string; per18: number };
  rounds: number;
  /** Players with enough holes to have a leak of their own, and how many share the team's. */
  players: number;
  sharing: number;
}

type HoleDetail = NonNullable<TeamRound['detail']>[number];
const counted = (h: HoleDetail) => h.p > 0 && h.d !== null && h.d > 0;

function per18(holes: HoleDetail[], baseline: [number, number][]) {
  const sums = new Map<FocusBand, number>(COACH_BANDS.map((b) => [b.key, 0]));
  for (const h of holes) {
    const k = bandOf(h.d!);
    sums.set(k, sums.get(k)! + expectedPutts(baseline, h.d!) - h.p);
  }
  return COACH_BANDS.map((b) => ({ key: b.key, label: b.label, per18: (sums.get(b.key)! / holes.length) * 18 }));
}

const worstOf = (bands: Leak['bands']) => bands.reduce((a, b) => (b.per18 < a.per18 ? b : a));

/**
 * Where the team loses putts, from every hole a player logged with a first-putt length. Scored per
 * 18 holes so a band that comes up every hole outweighs one that comes up twice a round.
 */
export function teamLeak(rounds: TeamRound[], players: string[], baseline: [number, number][]): Leak | null {
  const mine = rounds.filter((r) => players.includes(r.user_id));
  const holes = mine.flatMap((r) => (r.detail ?? []).filter(counted));
  if (holes.length < TEAM_MIN_HOLES) return null;
  const bands = per18(holes, baseline);
  const worst = worstOf(bands);

  let withLeak = 0;
  let sharing = 0;
  for (const p of players) {
    const own = mine.filter((r) => r.user_id === p).flatMap((r) => (r.detail ?? []).filter(counted));
    if (own.length < PLAYER_MIN_HOLES) continue;
    withLeak++;
    if (worstOf(per18(own, baseline)).key === worst.key) sharing++;
  }
  return {
    bands,
    worst,
    rounds: mine.filter((r) => (r.detail ?? []).some(counted)).length,
    players: withLeak,
    sharing,
  };
}

export interface PlayerWeek {
  user: string;
  rounds: number;
  sets: number;
  putts: number;
  /** The newest weekly test, any week. */
  test: { made: number; attempts: number; on: string } | null;
  /** Strokes gained per 18 over the last 30 days, minus the season. Null without both. */
  trend: number | null;
  /** Days since the last round or set. Null if nothing was ever logged. */
  quiet: number | null;
  didFocus: boolean;
}

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const daysBetween = (from: string, now: number) => Math.floor((now - Date.parse(`${from}T12:00:00`)) / DAY);

export function playerWeeks(
  players: string[],
  rounds: TeamRound[],
  practice: TeamPracticeRow[],
  stats: PlayerStats[],
  focus: { session: string; set_at: string } | null,
  now = Date.now(),
): PlayerWeek[] {
  const weekAgo = isoDay(now - 7 * DAY);
  const monthAgo = isoDay(now - 30 * DAY);
  const focusFrom = focus?.set_at.slice(0, 10) ?? '';
  return players.map((user) => {
    const rs = rounds.filter((r) => r.user_id === user && r.played_on);
    const ps = practice.filter((p) => p.user_id === user);
    const week = ps.filter((p) => p.played_on >= weekAgo);
    const test = ps.filter((p) => p.kind === 'test').sort((a, b) => b.played_on.localeCompare(a.played_on))[0];

    const recent = rs.filter((r) => r.played_on! >= monthAgo && r.sg !== null && (r.holes_played ?? 0) > 0);
    const holes = recent.reduce((a, r) => a + r.holes_played!, 0);
    const season = stats.find((s) => s.user_id === user)?.sg_pr ?? null;
    const trend = holes >= 18 && season !== null ? (recent.reduce((a, r) => a + r.sg!, 0) / holes) * 18 - season : null;

    const last = [...rs.map((r) => r.played_on!), ...ps.map((p) => p.played_on)].sort().pop();
    return {
      user,
      rounds: rs.filter((r) => r.played_on! >= weekAgo).length,
      sets: week.length,
      putts: week.reduce((a, p) => a + p.attempts, 0),
      test: test ? { made: test.made, attempts: test.attempts, on: test.played_on } : null,
      trend,
      quiet: last ? daysBetween(last, now) : null,
      didFocus: !!focus && ps.some((p) => p.session === focus.session && p.played_on >= focusFrom),
    };
  });
}
