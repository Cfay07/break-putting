import type { TeamPracticeRow } from './feed';
import type { TeamRound } from './teams';

export type Window = 'week' | 'month' | 'season' | 'all';

export const WINDOWS: { key: Window; label: string }[] = [
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
  { key: 'season', label: 'Season' },
  { key: 'all', label: 'All time' },
];

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * The season starts August 1: college golf runs fall into spring, so January is the same season
 * as October.
 */
export function seasonStart(now: number): string {
  const d = new Date(now);
  const year = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${year}-08-01`;
}

/** [from, to) as dates. The previous window is the same length right before it, for movement. */
export function windowRange(w: Window, now: number): { from: string; prevFrom: string | null } {
  if (w === 'week') return { from: iso(now - 7 * DAY), prevFrom: iso(now - 14 * DAY) };
  if (w === 'month') return { from: iso(now - 30 * DAY), prevFrom: iso(now - 60 * DAY) };
  if (w === 'season') return { from: seasonStart(now), prevFrom: null };
  return { from: '0000-01-01', prevFrom: null };
}

type Hole = NonNullable<TeamRound['detail']>[number];

export interface BoardDef {
  key: string;
  label: string;
  /** What the number is, said once under the board. */
  says: string;
  lowBetter: boolean;
  kind: 'rounds' | 'practice';
  /** The value and what it stands on, or null when there is not enough to rank. */
  score: (rounds: TeamRound[], practice: TeamPracticeRow[]) => { v: number; n: string } | null;
  fmt: (v: number) => string;
}

const holesOf = (rs: TeamRound[]) => rs.flatMap((r) => r.detail ?? []).filter((h) => h.p > 0);
const per18 = (sum: number, holes: number) => (sum / holes) * 18;
const roundsText = (n: number) => `${n} ${n === 1 ? 'round' : 'rounds'}`;
const signed1 = (v: number) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1));
const pctText = (v: number) => `${Math.round(v * 100)}%`;

/** Nine holes before a per-round rate means anything. */
const MIN_HOLES = 9;
/** Putts from a distance before a make rate is ranked. */
const MIN_TRIES = 8;

function rate(holes: Hole[], inBand: (h: Hole) => boolean, good: (h: Hole) => boolean) {
  const band = holes.filter((h) => h.d !== null && inBand(h));
  if (band.length < MIN_TRIES) return null;
  return { v: band.filter(good).length / band.length, n: `${band.filter(good).length} of ${band.length}` };
}

export const BOARDS: BoardDef[] = [
  {
    key: 'sg',
    label: 'Strokes gained',
    says: 'Putting strokes gained per 18 holes against tour averages.',
    lowBetter: false,
    kind: 'rounds',
    score: (rs) => {
      const ok = rs.filter((r) => r.sg !== null && (r.holes_played ?? 0) > 0);
      const holes = ok.reduce((a, r) => a + r.holes_played!, 0);
      if (holes < MIN_HOLES) return null;
      return {
        v: per18(
          ok.reduce((a, r) => a + r.sg!, 0),
          holes,
        ),
        n: roundsText(ok.length),
      };
    },
    fmt: signed1,
  },
  {
    key: 'putts',
    label: 'Fewest putts',
    says: 'Putts per 18 holes.',
    lowBetter: true,
    kind: 'rounds',
    score: (rs) => {
      const ok = rs.filter((r) => r.putts !== null && (r.holes_played ?? 0) > 0);
      const holes = ok.reduce((a, r) => a + r.holes_played!, 0);
      if (holes < MIN_HOLES) return null;
      return {
        v: per18(
          ok.reduce((a, r) => a + r.putts!, 0),
          holes,
        ),
        n: roundsText(ok.length),
      };
    },
    fmt: (v) => v.toFixed(1),
  },
  {
    key: 'clutch',
    label: '3 to 10 ft',
    says: 'First putts from 3 to 10 feet that went in.',
    lowBetter: false,
    kind: 'rounds',
    score: (rs) =>
      rate(
        holesOf(rs),
        (h) => h.d! >= 3 && h.d! <= 10,
        (h) => h.p === 1,
      ),
    fmt: pctText,
  },
  {
    key: 'lag',
    label: 'Lag',
    says: 'First putts from 30 feet and out finished in two or fewer.',
    lowBetter: false,
    kind: 'rounds',
    score: (rs) =>
      rate(
        holesOf(rs),
        (h) => h.d! >= 30,
        (h) => h.p <= 2,
      ),
    fmt: pctText,
  },
  {
    key: 'three',
    label: 'Fewest 3-putts',
    says: 'Three-putts per 18 holes.',
    lowBetter: true,
    kind: 'rounds',
    score: (rs) => {
      const ok = rs.filter((r) => r.three_putts !== null && (r.holes_played ?? 0) > 0);
      const holes = ok.reduce((a, r) => a + r.holes_played!, 0);
      if (holes < MIN_HOLES) return null;
      return {
        v: per18(
          ok.reduce((a, r) => a + r.three_putts!, 0),
          holes,
        ),
        n: roundsText(ok.length),
      };
    },
    fmt: (v) => v.toFixed(1),
  },
  {
    key: 'longest',
    label: 'Longest make',
    says: 'The longest first putt holed.',
    lowBetter: false,
    kind: 'rounds',
    score: (rs) => {
      const made = holesOf(rs).filter((h) => h.p === 1 && h.d !== null);
      if (!made.length) return null;
      const best = made.reduce((a, h) => (h.d! > a.d! ? h : a));
      const round = rs.find((r) => r.detail?.includes(best));
      return { v: best.d!, n: round?.course ?? 'on the course' };
    },
    fmt: (v) => `${v} ft`,
  },
  {
    key: 'work',
    label: 'Practice putts',
    says: 'Putts rolled in logged practice.',
    lowBetter: false,
    kind: 'practice',
    score: (_, ps) => {
      if (!ps.length) return null;
      const days = new Set(ps.map((p) => p.played_on)).size;
      return { v: ps.reduce((a, p) => a + p.attempts, 0), n: `${days} ${days === 1 ? 'day' : 'days'}` };
    },
    fmt: (v) => String(v),
  },
  {
    key: 'test',
    label: 'Weekly test',
    says: 'Best weekly test score, out of 18.',
    lowBetter: false,
    kind: 'practice',
    score: (_, ps) => {
      const tests = ps.filter((p) => p.kind === 'test' && p.attempts > 0);
      if (!tests.length) return null;
      const best = Math.max(...tests.map((t) => t.made));
      return { v: best, n: `${tests.length} ${tests.length === 1 ? 'test' : 'tests'}` };
    },
    fmt: (v) => `${v}/18`,
  },
];

export interface BoardRow {
  user: string;
  value: { v: number; n: string } | null;
  place: number | null;
  /** Places climbed since the window before. Null with no earlier window or no earlier place. */
  moved: number | null;
  /** Nothing at all in the window, as against too little to rank. */
  empty: boolean;
}

function rank(
  def: BoardDef,
  players: string[],
  rounds: TeamRound[],
  practice: TeamPracticeRow[],
  from: string,
  to: string,
  tournament: boolean,
) {
  const inR = rounds.filter(
    (r) => r.played_on && r.played_on >= from && r.played_on < to && (!tournament || r.competitive),
  );
  const inP = practice.filter((p) => p.played_on >= from && p.played_on < to);
  const scored = players.map((user) => ({
    user,
    empty: def.kind === 'rounds' ? !inR.some((r) => r.user_id === user) : !inP.some((p) => p.user_id === user),
    value: def.score(
      inR.filter((r) => r.user_id === user),
      inP.filter((p) => p.user_id === user),
    ),
  }));
  const ranked = scored
    .filter((s) => s.value)
    .sort((a, b) => (def.lowBetter ? a.value!.v - b.value!.v : b.value!.v - a.value!.v));
  // Ties share a place, like a leaderboard on tour: T2, T2, 4.
  const places = new Map<string, number>();
  ranked.forEach((s, i) => {
    const prev = ranked[i - 1];
    places.set(s.user, prev && prev.value!.v === s.value!.v ? places.get(prev.user)! : i + 1);
  });
  return { scored, places };
}

export function board(
  def: BoardDef,
  players: string[],
  rounds: TeamRound[],
  practice: TeamPracticeRow[],
  w: Window,
  tournament: boolean,
  now = Date.now(),
): BoardRow[] {
  const { from, prevFrom } = windowRange(w, now);
  const end = iso(now + DAY);
  const cur = rank(def, players, rounds, practice, from, end, tournament);
  const prev = prevFrom ? rank(def, players, rounds, practice, prevFrom, from, tournament) : null;
  return cur.scored
    .map(({ user, value, empty }) => {
      const place = cur.places.get(user) ?? null;
      const before = prev?.places.get(user) ?? null;
      return { user, value, place, empty, moved: place !== null && before !== null ? before - place : null };
    })
    .sort((a, b) => (a.place ?? 999) - (b.place ?? 999));
}
