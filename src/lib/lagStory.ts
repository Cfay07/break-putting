import { LAG_FROM, LEAVE_STANDARD } from './stats';
import { breakDirsOf, type Round } from './types';

/** One lag: the first putt on a hole from LAG_FROM feet or more, and where it left you. */
export interface Lag {
  roundId: string;
  date: string;
  course: string;
  hole: number;
  putterId: string;
  d: number;
  /** Feet left, nought when it went in. */
  leave: number;
  good: boolean;
  putts: number;
  uphill: boolean;
  downhill: boolean;
}

const real = (rounds: Round[]) =>
  rounds.filter((r) => r.finished && !r.practice).sort((a, b) => a.date.localeCompare(b.date));

export function lagsOf(rounds: Round[]): Lag[] {
  const out: Lag[] = [];
  for (const r of real(rounds))
    for (const h of r.holes) {
      const first = h.putts[0];
      if (!first || first.d < LAG_FROM) continue;
      const leave = first.made ? 0 : h.putts[1]?.d;
      if (leave === undefined) continue;
      const dirs = breakDirsOf(first);
      out.push({
        roundId: r.id,
        date: r.date,
        course: r.course ?? '',
        hole: h.hole,
        putterId: r.putterId,
        d: first.d,
        leave,
        good: first.made || leave <= first.d * LEAVE_STANDARD,
        putts: h.putts.length,
        uphill: dirs.includes('uphill'),
        downhill: dirs.includes('downhill'),
      });
    }
  return out;
}

/** Rounds in each point of the trend, and lags a point needs before it is drawn. */
export const TREND_ROUNDS = 5;
export const TREND_MIN_LAGS = 10;

export interface TrendPoint {
  date: string;
  rate: number;
  lags: number;
  putterId: string;
}

/** Inside-10% over the last five rounds at each round, drawn once the window holds enough lags. */
export function lagTrend(rounds: Round[]): TrendPoint[] {
  const lags = lagsOf(rounds);
  const rs = real(rounds).filter((r) => lags.some((l) => l.roundId === r.id));
  const points: TrendPoint[] = [];
  rs.forEach((r, i) => {
    const ids = new Set(rs.slice(Math.max(0, i - TREND_ROUNDS + 1), i + 1).map((x) => x.id));
    const w = lags.filter((l) => ids.has(l.roundId));
    if (w.length < TREND_MIN_LAGS) return;
    points.push({
      date: r.date,
      rate: w.filter((l) => l.good).length / w.length,
      lags: w.length,
      putterId: r.putterId,
    });
  });
  return points;
}

const pct = (x: number) => Math.round(x * 100);
const day = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** The line on top: where the trend sits now, and the swing that got it there when there was one. */
export function lagTrendStory(points: TrendPoint[]): string | null {
  if (points.length < 2) return null;
  const now = points[points.length - 1];
  const head = `Over your last ${TREND_ROUNDS} rounds, ${pct(now.rate)}% of your lags finished inside 10%.`;
  const low = points.reduce((m, p) => (p.rate < m.rate ? p : m));
  const high = points.reduce((m, p) => (p.rate > m.rate ? p : m));
  if (low !== now && now.rate - low.rate >= 0.2) return `${head} Up from ${pct(low.rate)}% around ${day(low.date)}.`;
  if (high !== now && high.rate - now.rate >= 0.2)
    return `${head} Down from ${pct(high.rate)}% around ${day(high.date)}.`;
  return head;
}

/** Lags a split needs on every side before it is shown. */
const MIN_SPLIT = 5;

export interface LagSplit {
  label: string;
  good: number;
  lags: number;
  avgLeave: number;
}

function split(label: string, ls: Lag[]): LagSplit {
  return {
    label,
    good: ls.filter((l) => l.good).length,
    lags: ls.length,
    avgLeave: ls.length ? ls.reduce((a, l) => a + l.leave, 0) / ls.length : 0,
  };
}

export function lagByLength(lags: Lag[]): LagSplit[] {
  const rows = [
    split(
      '30 to 40 ft',
      lags.filter((l) => l.d <= 40),
    ),
    split(
      '41 to 50 ft',
      lags.filter((l) => l.d > 40 && l.d <= 50),
    ),
    split(
      '51 ft and out',
      lags.filter((l) => l.d > 50),
    ),
  ].filter((r) => r.lags >= MIN_SPLIT);
  return rows.length >= 2 ? rows : [];
}

export function lagBySlope(lags: Lag[]): LagSplit[] {
  const rows = [
    split(
      'Uphill',
      lags.filter((l) => l.uphill),
    ),
    split(
      'Downhill',
      lags.filter((l) => l.downhill),
    ),
  ];
  return rows.every((r) => r.lags >= MIN_SPLIT) ? rows : [];
}

/** Holed lags first, longest first, then the closest leaves for their length. */
export function bestLags(lags: Lag[], n = 3): Lag[] {
  const holed = lags.filter((l) => l.leave === 0).sort((a, b) => b.d - a.d);
  const close = lags.filter((l) => l.leave > 0).sort((a, b) => a.leave / a.d - b.leave / b.d);
  return [...holed, ...close].slice(0, n);
}

/** The leaves furthest from the hole for their length. */
export function worstLags(lags: Lag[], n = 3): Lag[] {
  return lags
    .filter((l) => !l.good)
    .sort((a, b) => b.leave / b.d - a.leave / a.d)
    .slice(0, n);
}
