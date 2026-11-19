import { fmtDate } from './format';
import { holeSG } from './sg';
import { readError } from './readError';
import { roundStats } from './stats';
import { faultyOf } from './xp';
import { holeVsPar, type Round } from './types';

/**
 * Where a round sits among every round you have logged. The record is found for you, the way a
 * run app spots a personal best without being asked: you open the round and it already knows
 * this was your second-fewest putts.
 *
 * Only real records. A rank needs five rounds to rank against, and a tie for best is said as a tie,
 * because a trophy everyone gets stops meaning anything.
 */

interface Metric {
  key: string;
  label: string;
  /** Count stats compare like for like: nine holes against nine, eighteen against eighteen. */
  sameLength: boolean;
  lowBetter: boolean;
  value: (r: Round, baseline: [number, number][]) => number | null;
  fmt: (v: number) => string;
}

const madeLengths = (r: Round) => r.holes.flatMap((h) => h.putts.filter((p) => p.made).map((p) => p.d));
const playedHoles = (r: Round) => r.holes.filter((h) => h.putts.length > 0).length;

/** First putts from 30 ft and out: how far from the hole they finished, on average. A make is zero. */
function lagLeave(r: Round): number | null {
  const lags = r.holes.filter((h) => h.putts.length && h.putts[0].d >= 30);
  if (lags.length < 2) return null;
  return lags.reduce((a, h) => a + (h.putts[0].made ? 0 : (h.putts[1]?.d ?? 0)), 0) / lags.length;
}

export const METRICS: Metric[] = [
  {
    key: 'sg',
    label: 'Strokes gained',
    sameLength: false,
    lowBetter: false,
    value: (r, b) => {
      const s = roundStats(r, b);
      return s.holesPlayed >= 9 ? (s.sg / s.holesPlayed) * 18 : null;
    },
    fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} a round`,
  },
  {
    key: 'putts',
    label: 'Fewest putts',
    sameLength: true,
    lowBetter: true,
    value: (r, b) => roundStats(r, b).totalPutts,
    fmt: (v) => `${v} putts`,
  },
  {
    key: 'ones',
    label: 'Most one-putts',
    sameLength: true,
    lowBetter: false,
    value: (r, b) => roundStats(r, b).onePutts,
    fmt: (v) => `${v} one-putts`,
  },
  {
    key: 'feet',
    label: 'Most feet holed',
    sameLength: true,
    lowBetter: false,
    value: (r) => madeLengths(r).reduce((a, d) => a + d, 0),
    fmt: (v) => `${v} ft`,
  },
  {
    key: 'longest',
    label: 'Longest make',
    sameLength: false,
    lowBetter: false,
    value: (r) => (madeLengths(r).length ? Math.max(...madeLengths(r)) : null),
    fmt: (v) => `${v} ft`,
  },
  {
    key: 'scoring',
    label: 'Best from 3 to 10 ft',
    sameLength: false,
    lowBetter: false,
    value: (r, b) => {
      const t = roundStats(r, b).scoring;
      return t.attempts >= 5 ? t.makes / t.attempts : null;
    },
    fmt: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: 'score',
    label: 'Lowest score',
    sameLength: true,
    lowBetter: true,
    value: (r) => {
      const played = r.holes.filter((h) => h.putts.length > 0 || h.holedOut);
      if (!played.length || played.some((h) => holeVsPar(h) === undefined)) return null;
      return played.reduce((a, h) => a + holeVsPar(h)!, 0);
    },
    fmt: (v) => (v === 0 ? 'Even par' : v > 0 ? `+${v}` : String(v)),
  },
  {
    key: 'greens',
    label: 'Most greens hit',
    sameLength: true,
    lowBetter: false,
    value: (r, b) => {
      const s = roundStats(r, b);
      return s.scoredHoles >= 9 ? s.gir : null;
    },
    fmt: (v) => `${v} greens`,
  },
  {
    key: 'birdies',
    label: 'Most birdies or better',
    sameLength: true,
    lowBetter: false,
    value: (r) => {
      const scored = r.holes.filter((h) => holeVsPar(h) !== undefined);
      return scored.length >= 9 ? scored.filter((h) => holeVsPar(h)! < 0).length : null;
    },
    fmt: (v) => `${v} ${v === 1 ? 'birdie' : 'birdies'}`,
  },
  {
    key: 'front',
    label: 'Most through the front door',
    sameLength: false,
    lowBetter: false,
    value: (r) => {
      const makes = r.holes.flatMap((h) => h.putts.filter((p) => p.made && p.cupEntry && p.cupEntry !== 'unsure'));
      return makes.length >= 4 ? makes.filter((p) => p.cupEntry === 'front').length / makes.length : null;
    },
    fmt: (v) => `${Math.round(v * 100)}% of makes`,
  },
  {
    key: 'pars',
    label: 'Most pars or better',
    sameLength: true,
    lowBetter: false,
    value: (r) => {
      const scored = r.holes.filter((h) => holeVsPar(h) !== undefined);
      return scored.length >= 9 ? scored.filter((h) => holeVsPar(h)! <= 0).length : null;
    },
    fmt: (v) => `${v} pars or better`,
  },
  {
    key: 'short',
    label: 'Best inside 5 ft',
    sameLength: false,
    lowBetter: false,
    value: (r) => {
      const ps = r.holes.flatMap((h) => h.putts.filter((p) => p.d >= 3 && p.d <= 5));
      return ps.length >= 4 ? ps.filter((p) => p.made).length / ps.length : null;
    },
    fmt: (v) => `${Math.round(v * 100)}% from 3 to 5 ft`,
  },
  {
    key: 'mid',
    label: 'Most makes from 10 to 20 ft',
    sameLength: false,
    lowBetter: false,
    value: (r) => r.holes.flatMap((h) => h.putts.filter((p) => p.made && p.d >= 10 && p.d <= 20)).length,
    fmt: (v) => `${v} from 10 to 20 ft`,
  },
  {
    key: 'reads',
    label: 'Best green reading',
    sameLength: false,
    lowBetter: false,
    value: (r) => {
      const read = readError([r]);
      return read.judged >= 5 ? read.hadIt / read.judged : null;
    },
    fmt: (v) => `${Math.round(v * 100)}% read right`,
  },
  {
    key: 'stroke',
    label: 'Cleanest stroke',
    sameLength: false,
    lowBetter: false,
    value: (r) => {
      const ps = r.holes.flatMap((h) => h.putts.filter((p) => p.executionAssessed));
      return ps.length >= 6 ? ps.filter((p) => !faultyOf(p)).length / ps.length : null;
    },
    fmt: (v) => `${Math.round(v * 100)}% struck clean`,
  },
  {
    key: 'threes',
    label: 'Fewest three-putts',
    sameLength: true,
    lowBetter: true,
    value: (r) => r.holes.filter((h) => h.putts.length >= 3).length,
    fmt: (v) => `${v} three-putts`,
  },
  {
    key: 'lag',
    label: 'Best lag putting',
    sameLength: false,
    lowBetter: true,
    value: (r) => lagLeave(r),
    fmt: (v) => `${v.toFixed(1)} ft left from 30+`,
  },
];

export interface RankLine {
  key: string;
  label: string;
  value: string;
  rank: number;
  of: number;
  tied: boolean;
  /** Rounds sharing this exact number, this one included. */
  same: number;
  /** Rounds compared against, in words: "18-hole rounds" or "rounds". */
  pool: string;
  /** Not a top three, but the best since this date, this many rounds back. */
  since?: { date: string; rounds: number };
}

const MIN_POOL = 8;
const SINCE_GAP = 5;

function comparable(round: Round, all: Round[], m: Metric) {
  const n = playedHoles(round);
  return all.filter((r) => r.finished && !r.practice && playedHoles(r) > 0 && (!m.sameLength || playedHoles(r) === n));
}

/** Every metric this round can be ranked on, best rank first. */
export function roundRanks(round: Round, all: Round[], baseline: [number, number][]): RankLine[] {
  const out: RankLine[] = [];
  const n = playedHoles(round);
  for (const m of METRICS) {
    const mine = m.value(round, baseline);
    if (mine === null) continue;
    const pool = comparable(round, all, m)
      .filter((r) => r.id !== round.id)
      .map((r) => ({ r, v: m.value(r, baseline) }))
      .filter((x): x is { r: Round; v: number } => x.v !== null);
    if (pool.length + 1 < MIN_POOL) continue;
    const better = (v: number) => (m.lowBetter ? v < mine : v > mine);
    const rank = 1 + pool.filter((x) => better(x.v)).length;
    const same = 1 + pool.filter((x) => x.v === mine).length;
    const tied = same > 1;
    const line: RankLine = {
      key: m.key,
      label: m.label,
      value: m.fmt(mine),
      rank,
      of: pool.length + 1,
      tied,
      same,
      pool: m.sameLength ? `${n}-hole rounds` : 'rounds',
    };
    if (rank > 3) {
      // Best since: the most recent earlier round that did as well or better.
      const earlier = pool.filter((x) => x.r.date < round.date).sort((a, b) => b.r.date.localeCompare(a.r.date));
      const idx = earlier.findIndex((x) => (m.lowBetter ? x.v <= mine : x.v >= mine));
      if (idx >= SINCE_GAP) line.since = { date: earlier[idx].r.date, rounds: idx };
    }
    out.push(line);
  }
  return out.sort(
    (a, b) => a.rank - b.rank || METRICS.findIndex((m) => m.key === a.key) - METRICS.findIndex((m) => m.key === b.key),
  );
}

/** The headline records: top three ranks first, then "best since" lines, three at most. */
export function headlineRanks(lines: RankLine[]): RankLine[] {
  // A number a quarter of your rounds share is not a record: zero three-putts is a good day, not a trophy.
  const top = lines.filter((l) => l.rank <= 3 && l.same <= Math.max(1, Math.floor(l.of / 4)));
  const since = lines.filter((l) => l.rank > 3 && l.since).sort((a, b) => b.since!.rounds - a.since!.rounds);
  return [...top, ...since].slice(0, 3);
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

/** "Your best of 31 18-hole rounds", "2nd of 31", "Tied for best", "Best since Sep 24". */
export function rankText(l: RankLine): string {
  if (l.since) return `Best since ${fmtDate(l.since.date)}, ${l.since.rounds} rounds back`;
  if (l.rank === 1) return l.tied ? `Tied for your best of ${l.of} ${l.pool}` : `Your best of ${l.of} ${l.pool}`;
  return `${l.tied ? 'Tied ' : ''}${ordinal(l.rank)} of your ${l.of} ${l.pool}`;
}

/** What you usually do, for the number tiles: the middle of your other comparable rounds. */
export function usual(round: Round, all: Round[], baseline: [number, number][], key: string): number | null {
  const m = METRICS.find((x) => x.key === key);
  if (!m) return null;
  const vs = comparable(round, all, m)
    .filter((r) => r.id !== round.id)
    .map((r) => m.value(r, baseline))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  if (vs.length < MIN_POOL - 1) return null;
  const mid = Math.floor(vs.length / 2);
  return vs.length % 2 ? vs[mid] : (vs[mid - 1] + vs[mid]) / 2;
}

/** The hole that gave the most and the one that cost the most, by putting strokes gained. */
export function swingHoles(round: Round, baseline: [number, number][]) {
  const scored = round.holes
    .filter((h) => h.putts.length)
    .map((h) => ({
      hole: h.hole,
      first: h.putts[0].d,
      putts: h.putts.length,
      sg: holeSG(
        baseline,
        h.putts.map((p) => p.d),
        h.putts.length,
      ),
    }));
  if (scored.length < 3) return null;
  const best = scored.reduce((a, h) => (h.sg > a.sg ? h : a));
  const worst = scored.reduce((a, h) => (h.sg < a.sg ? h : a));
  return { best, worst };
}

/** Every comparable round on one measure, best first: your own leaderboard for it. */
export function rankedRounds(round: Round, all: Round[], baseline: [number, number][], key: string) {
  const m = METRICS.find((x) => x.key === key);
  if (!m) return null;
  const rows = comparable(round, all, m)
    .map((r) => ({ round: r, v: m.value(r, baseline) }))
    .filter((x): x is { round: Round; v: number } => x.v !== null)
    .sort((a, b) => (m.lowBetter ? a.v - b.v : b.v - a.v) || b.round.date.localeCompare(a.round.date));
  return {
    label: m.label,
    rows: rows.map((x) => ({
      round: x.round,
      value: m.fmt(x.v),
      place: 1 + rows.filter((y) => (m.lowBetter ? y.v < x.v : y.v > x.v)).length,
    })),
  };
}

/** Every round on one measure, best first, without a round to anchor it: the History leaderboards. */
export function rankedBy(all: Round[], baseline: [number, number][], key: string, length?: number) {
  const m = METRICS.find((x) => x.key === key);
  if (!m) return null;
  const rows = all
    .filter((r) => r.finished && !r.practice && playedHoles(r) > 0 && (!length || playedHoles(r) === length))
    .map((r) => ({ round: r, v: m.value(r, baseline) }))
    .filter((x): x is { round: Round; v: number } => x.v !== null)
    .sort((a, b) => (m.lowBetter ? a.v - b.v : b.v - a.v) || a.round.date.localeCompare(b.round.date));
  return {
    label: m.label,
    rows: rows.map((x) => ({
      round: x.round,
      value: m.fmt(x.v),
      place: 1 + rows.filter((y) => (m.lowBetter ? y.v < x.v : y.v > x.v)).length,
    })),
  };
}
