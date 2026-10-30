import { sample, confidenceOf, type Sample } from './sample';
import { bucketOf, overall, type BucketKey } from './stats';
import type { BallMode, Lean, PracticeSet, Putt, Round, Zone } from './types';

export const ZONES: { key: Zone; label: string; buckets: BucketKey[] }[] = [
  { key: 'tapin', label: '2 ft and in', buckets: ['tapin'] },
  { key: 'short', label: '3 to 5 ft', buckets: ['b35'] },
  { key: 'mid', label: '6 to 8 ft', buckets: ['b68'] },
  { key: 'long', label: '9 to 15 ft', buckets: ['b915'] },
  { key: 'lag', label: '16 ft and out', buckets: ['b1630', 'b3140', 'b4150', 'b5160', 'b61'] },
];

/** Putts a zone needs before it can be named the place to practice. */
export const FOCUS_NEED = 30;

/**
 * Below this a new putter has not been played enough to speak for itself, so the focus falls
 * back to every round and says so. Above it the old putter is left out entirely, because the
 * L.A.B. and the Cobra putt like two different players.
 */
export const MIN_PUTTER_ROUNDS = 3;

/** Tagged misses a zone needs before its habit is worth naming. */
export const LEAN_NEED = 6;

export interface LeanRead {
  lean: Lean;
  n: number;
  of: number;
}

export interface ZoneRead {
  zone: Zone;
  label: string;
  /** Strokes gained per eighteen holes against the baseline, from putts starting in this zone. */
  sgPerRound: number;
  /**
   * The same against scratch, per putt. A wide zone collects more putts a round, so its per-round
   * number is bigger without the putting being worse; this is the skill gap on its own.
   */
  sgPerPutt: number;
  makes: number;
  attempts: number;
  sample: Sample;
  lean: LeanRead | null;
}

export interface Focus {
  /** Rounds the zones were read from: the recent ones. */
  rounds: number;
  /** Every round with this putter, recent or not. */
  allRounds: number;
  /** True when only the active putter's rounds were used. */
  putterOnly: boolean;
  zones: ZoneRead[];
  /** The zone costing the most lately, among those with enough putts to say so. */
  worst: Zone | null;
  /** Second place, when it is close enough that the order could be noise. */
  close: Zone | null;
  /** The biggest leak over every round with this putter, when it differs from the recent one. */
  wasWorst: ZoneRead | null;
}

/**
 * Practice should chase how you putt now, not how you putted in August. A weakness the
 * last ten rounds have already fixed is not worth a winter, however loud it still is in the
 * season totals.
 */
export const RECENT_ROUNDS = 10;

/**
 * Inside this many strokes a round, two zones are a tie at this sample size. A round-to-round
 * spread of three-plus strokes swamps a difference this small.
 */
export const CLOSE_CALL = 0.1;

function zoneOf(d: number): Zone {
  const b = bucketOf(d);
  return ZONES.find((z) => z.buckets.includes(b))!.key;
}

/**
 * What the misses from one zone keep doing. Only misses carrying a tag count, and the habit has
 * to cover at least half of them, or the honest answer is that they are spread out.
 */
export function leanOf(putts: Putt[]): LeanRead | null {
  const tagged = putts.filter(
    (p) => !p.made && (p.push || p.pull || p.speed === 'short' || p.speed === 'long' || p.missSide === 'high' || p.missSide === 'low'),
  );
  if (tagged.length < LEAN_NEED) return null;
  const counts: [Lean, number][] = [
    ['start-line', tagged.filter((p) => p.push || p.pull).length],
    ['short', tagged.filter((p) => p.speed === 'short').length],
    ['long', tagged.filter((p) => p.speed === 'long').length],
    ['high', tagged.filter((p) => p.missSide === 'high').length],
    ['low', tagged.filter((p) => p.missSide === 'low').length],
  ];
  const [lean, n] = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return n * 2 >= tagged.length ? { lean, n, of: tagged.length } : null;
}

export const LEAN_TEXT: Record<Lean, string> = {
  'start-line': 'were a push or a pull',
  short: 'came up short',
  long: 'ran long',
  high: 'missed on the high side',
  low: 'missed on the low side',
};

/**
 * Where the putting strokes go, by distance, and which zone to work on first. Built from the
 * same per-putt strokes gained the Stats page uses, so the two always agree.
 */
/**
 * The rounds that speak for how you putt now: the current putter's once it has enough of them,
 * every round until then.
 */
export function scopeRounds(rounds: Round[], putterId?: string): { rounds: Round[]; putterOnly: boolean } {
  const done = rounds.filter((r) => r.finished);
  const mine = putterId ? done.filter((r) => r.putterId === putterId) : [];
  const putterOnly = mine.length >= MIN_PUTTER_ROUNDS;
  return { rounds: putterOnly ? mine : done, putterOnly };
}

function zonesOf(rounds: Round[], baseline: [number, number][]) {
  const o = overall(rounds, baseline);
  const byZone = new Map<Zone, Putt[]>();
  for (const r of rounds) {
    for (const h of r.holes) {
      for (const p of h.putts) {
        const z = zoneOf(p.d);
        const list = byZone.get(z) ?? [];
        list.push(p);
        byZone.set(z, list);
      }
    }
  }
  const zones: ZoneRead[] = ZONES.map((z) => {
    const attempts = z.buckets.reduce((s, b) => s + o.pooled.buckets[b].attempts, 0);
    const makes = z.buckets.reduce((s, b) => s + o.pooled.buckets[b].makes, 0);
    const sgPerRound = z.buckets.reduce((s, b) => s + (o.bucketSgPerRound[b] ?? 0), 0);
    const sg = z.buckets.reduce((s, b) => s + o.pooled.buckets[b].sg, 0);
    const counted = z.buckets.reduce((s, b) => s + o.pooled.buckets[b].sgPutts, 0);
    return {
      zone: z.key,
      label: z.label,
      sgPerRound,
      sgPerPutt: counted ? sg / counted : 0,
      makes,
      attempts,
      sample: sample(attempts, FOCUS_NEED, 'putts'),
      lean: leanOf(byZone.get(z.key) ?? []),
    };
  });
  const ranked = zones
    .filter((z) => confidenceOf(z.sample) !== 'waiting' && z.sgPerRound < 0)
    .sort((a, b) => a.sgPerRound - b.sgPerRound);
  return { zones, ranked };
}

/**
 * Where the putting strokes go lately, by distance, and which zone to work on first. Built from
 * the same per-putt strokes gained the Stats page uses, on the current putter's last ten rounds.
 */
export function focusOf(rounds: Round[], baseline: [number, number][], putterId?: string): Focus {
  const { rounds: scoped, putterOnly } = scopeRounds(rounds, putterId);
  const sorted = [...scoped].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-RECENT_ROUNDS);
  const now = zonesOf(recent, baseline);
  const [first, second] = now.ranked;
  const close = first && second && second.sgPerRound - first.sgPerRound < CLOSE_CALL ? second.zone : null;
  const before = sorted.length > recent.length ? zonesOf(sorted, baseline).ranked[0] : undefined;
  return {
    rounds: recent.length,
    allRounds: sorted.length,
    putterOnly,
    zones: now.zones,
    worst: first?.zone ?? null,
    close,
    wasWorst: before && before.zone !== first?.zone ? before : null,
  };
}

export interface DrillHistory {
  drill: string;
  sets: PracticeSet[];
  made: number;
  attempts: number;
  best: PracticeSet;
  last: PracticeSet;
}

/** Oldest first, so a chart reads left to right. Updated breaks a same-day tie. */
export function byTime(a: PracticeSet, b: PracticeSet): number {
  return a.date.localeCompare(b.date) || (a.updated ?? '').localeCompare(b.updated ?? '');
}

/** One number per set that can be ranked: share counted, a run, stations reached, a win. */
export function scoreOf(s: PracticeSet): number {
  if (s.game) return s.game.result === 'win' ? 1 : s.game.result === 'tie' ? 0.5 : 0;
  if (s.run !== undefined) return s.run;
  if (s.reached !== undefined) return s.reached + (s.finished ? 0.5 : 0);
  return s.attempts ? s.made / s.attempts : 0;
}

/** Sets that are not games, grouped by drill family, so an edited copy keeps the original's record. */
export function historyOf(sets: PracticeSet[], family: string, familyOf: (id: string) => string): DrillHistory | null {
  const mine = sets.filter((s) => !s.game && familyOf(s.drill) === family).sort(byTime);
  if (!mine.length) return null;
  return {
    drill: family,
    sets: mine,
    made: mine.reduce((s, x) => s + x.made, 0),
    attempts: mine.reduce((s, x) => s + x.attempts, 0),
    best: mine.reduce((a, b) => (scoreOf(b) > scoreOf(a) ? b : a)),
    last: mine[mine.length - 1],
  };
}

/** Every drill that has been rolled, most recently used first. */
export function histories(sets: PracticeSet[], familyOf: (id: string) => string): DrillHistory[] {
  const ids = [...new Set(sets.filter((s) => !s.game).map((s) => familyOf(s.drill)))];
  return ids
    .map((id) => historyOf(sets, id, familyOf)!)
    .sort((a, b) => byTime(b.last, a.last));
}

export interface PracticeTotals {
  sets: number;
  putts: number;
  days: number;
}

export function totalsOf(sets: PracticeSet[]): PracticeTotals {
  return {
    sets: sets.length,
    putts: sets.reduce((s, x) => s + x.attempts, 0),
    days: new Set(sets.map((s) => s.date)).size,
  };
}

/** Putts rolled per day, for the calendar. */
export function puttsByDay(sets: PracticeSet[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sets) m.set(s.date, (m.get(s.date) ?? 0) + s.attempts);
  return m;
}

/* ---------- practice against play ---------- */

/** A course putt counts as "from here" inside this window: a foot either side, a tenth past ten feet. */
export function windowOf(d: number): number {
  return Math.max(1, Math.round(d * 0.1));
}

/** Practice balls a distance needs before it is compared, and course putts on the other side. */
export const PRACTICE_NEED = 10;
export const PLAY_NEED = 15;

export interface Tally2 {
  made: number;
  attempts: number;
}

export interface DistanceRead {
  d: number;
  mode: BallMode;
  practice: Tally2;
  play: Tally2;
  /** Practice share minus course share, in points, when both sides have enough. */
  gap: number | null;
}

/**
 * The same question asked of the course. A make is a make. A two-putt is the hole finished in
 * two from a first putt at this distance. A zone ball is holed or left inside the zone, judged
 * off the next putt's length, which is exactly how far the ball stopped.
 */
export function playAt(rounds: Round[], d: number, mode: BallMode, zoneFt = 1.5): Tally2 {
  const w = windowOf(d);
  const near = (x: number) => Math.abs(x - d) <= w;
  let made = 0;
  let attempts = 0;
  for (const r of rounds) {
    for (const h of r.holes) {
      if (mode === 'twoputt') {
        if (h.putts.length && near(h.putts[0].d) && h.putts[h.putts.length - 1].made) {
          attempts++;
          if (h.putts.length <= 2) made++;
        }
        continue;
      }
      h.putts.forEach((p, i) => {
        if (!near(p.d)) return;
        if (mode === 'make') {
          attempts++;
          if (p.made) made++;
          return;
        }
        const next = h.putts[i + 1];
        if (!p.made && !next) return;
        attempts++;
        if (p.made || next.d <= zoneFt) made++;
      });
    }
  }
  return { made, attempts };
}

const pctOf = (t: Tally2) => (t.attempts ? (t.made / t.attempts) * 100 : 0);

/** Every distance this set of sets was rolled from, practice beside play. */
export function practiceVsPlay(
  sets: PracticeSet[],
  rounds: Round[],
  zoneFtOf: (d: number) => number = () => 1.5,
): DistanceRead[] {
  const byKey = new Map<string, { d: number; mode: BallMode; t: Tally2 }>();
  for (const s of sets) {
    for (const st of s.stations ?? []) {
      if (st.d <= 0) continue;
      const key = `${st.mode}|${st.d}`;
      const cur = byKey.get(key) ?? { d: st.d, mode: st.mode, t: { made: 0, attempts: 0 } };
      cur.t.made += st.made;
      cur.t.attempts += st.attempts;
      byKey.set(key, cur);
    }
  }
  return [...byKey.values()]
    .sort((a, b) => a.mode.localeCompare(b.mode) || a.d - b.d)
    .map(({ d, mode, t }) => {
      const play = playAt(rounds, d, mode, zoneFtOf(d));
      const both = t.attempts >= PRACTICE_NEED && play.attempts >= PLAY_NEED;
      return { d, mode, practice: t, play, gap: both ? pctOf(t) - pctOf(play) : null };
    });
}

/** The distance where practice and play disagree most, among those with enough on both sides. */
export function biggestGap(reads: DistanceRead[]): DistanceRead | null {
  return reads.filter((r) => r.gap !== null).sort((a, b) => b.gap! - a.gap!)[0] ?? null;
}

/* ---------- getting better ---------- */

/** Balls each half needs before a change can be called. */
export const TREND_NEED = 30;

export interface Trend {
  verdict: 'up' | 'down' | 'flat' | 'waiting';
  /** Later share minus earlier share, in points. */
  diff: number;
  /** Half-width of the 95% interval on that difference, in points. */
  margin: number;
  earlier: Tally2;
  later: Tally2;
}

/**
 * Earlier half of the balls against the later half, on one surface, so a mat never flatters a
 * green. Up or down only when the change is bigger than its own noise; otherwise it says flat and
 * prints the margin, because "no clear change" is a real answer.
 */
export function trendOf(sets: PracticeSet[]): Trend {
  const counted = [...sets].filter((s) => s.attempts > 0 && s.run === undefined && s.reached === undefined && !s.game).sort(byTime);
  const total = counted.reduce((n, s) => n + s.attempts, 0);
  const earlier = { made: 0, attempts: 0 };
  const later = { made: 0, attempts: 0 };
  let seen = 0;
  for (const s of counted) {
    const side = seen + s.attempts / 2 <= total / 2 ? earlier : later;
    side.made += s.made;
    side.attempts += s.attempts;
    seen += s.attempts;
  }
  if (earlier.attempts < TREND_NEED || later.attempts < TREND_NEED) {
    return { verdict: 'waiting', diff: 0, margin: 0, earlier, later };
  }
  const p1 = earlier.made / earlier.attempts;
  const p2 = later.made / later.attempts;
  const diff = (p2 - p1) * 100;
  const margin = 196 * Math.sqrt((p1 * (1 - p1)) / earlier.attempts + (p2 * (1 - p2)) / later.attempts);
  const verdict = diff > margin ? 'up' : diff < -margin ? 'down' : 'flat';
  return { verdict, diff, margin, earlier, later };
}
