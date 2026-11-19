import { courseLabel } from './stats';
import { fmtDate } from './format';
import { METRICS } from './roundRanks';
import { holeVsPar, type Round } from './types';

/**
 * The trophy room: the best and worst of everything you have logged, each one a real round you
 * can open. Highs are the records to beat; lows are the ones you never want to see again.
 */
export interface Trophy {
  key: string;
  title: string;
  value: string;
  /** "Nov 10 · Strawberry Creek · hole 4" */
  where: string;
  roundId: string;
  hole?: number;
  /** A ranking you can open as a full list of your rounds. */
  metric?: string;
  /** Hole count the metric list is for, when it compares like with like. */
  length?: number;
}

const rounds = (all: Round[]) => all.filter((r) => r.finished && !r.practice && r.holes.some((h) => h.putts.length));
const played = (r: Round) => r.holes.filter((h) => h.putts.length > 0).length;
const where = (r: Round, hole?: number) =>
  [fmtDate(r.date), courseLabel(r).replace(/ \(\d+\)$/, ''), hole ? `hole ${hole}` : ''].filter(Boolean).join(' · ');

function fromMetric(
  all: Round[],
  baseline: [number, number][],
  key: string,
  title: string,
  worst: boolean,
  length?: number,
): Trophy | null {
  const m = METRICS.find((x) => x.key === key)!;
  const pool = rounds(all)
    .filter((r) => !length || played(r) === length)
    .map((r) => ({ r, v: m.value(r, baseline) }))
    .filter((x): x is { r: Round; v: number } => x.v !== null);
  if (pool.length < 3) return null;
  const lowWins = m.lowBetter !== worst;
  // Earliest wins a tie: a record is set once, then matched.
  const best = pool.reduce((a, x) => {
    if (x.v === a.v) return x.r.date < a.r.date ? x : a;
    return lowWins ? (x.v < a.v ? x : a) : x.v > a.v ? x : a;
  });
  return {
    key: `${worst ? 'low' : 'high'}-${key}-${length ?? 'all'}`,
    title,
    value: m.fmt(best.v),
    where: where(best.r),
    roundId: best.r.id,
    metric: key,
    length,
  };
}

/** Rounds in a row without a three-putt, oldest first. */
function noThreeRun(all: Round[]): Trophy | null {
  const rs = rounds(all)
    .filter((r) => played(r) >= 9)
    .sort((a, b) => a.date.localeCompare(b.date));
  let best = { n: 0, end: -1 };
  let run = 0;
  rs.forEach((r, i) => {
    run = r.holes.some((h) => h.putts.length >= 3) ? 0 : run + 1;
    if (run > best.n) best = { n: run, end: i };
  });
  if (best.n < 2) return null;
  const first = rs[best.end - best.n + 1];
  const last = rs[best.end];
  return {
    key: 'high-nothree',
    title: 'Longest run without a three-putt',
    value: `${best.n} rounds`,
    where: `${fmtDate(first.date)} to ${fmtDate(last.date)}`,
    roundId: last.id,
  };
}

/** One-putt holes in a row inside one round. */
function onePuttRun(all: Round[]): Trophy | null {
  let best = { n: 0, r: null as Round | null, from: 0 };
  for (const r of rounds(all)) {
    let run = 0;
    for (const h of r.holes.filter((x) => x.putts.length)) {
      run = h.putts.length === 1 && h.putts[0].made ? run + 1 : 0;
      if (run > best.n || (run === best.n && best.r && r.date < best.r.date))
        best = { n: run, r, from: h.hole - run + 1 };
    }
  }
  if (!best.r || best.n < 3) return null;
  return {
    key: 'high-onerun',
    title: 'Most one-putts in a row',
    value: `${best.n} holes`,
    where: where(best.r, best.from),
    roundId: best.r.id,
    hole: best.from,
  };
}

function longestMake(all: Round[]): Trophy | null {
  let best: { d: number; r: Round; hole: number } | null = null;
  for (const r of rounds(all))
    for (const h of r.holes)
      for (const p of h.putts) if (p.made && (!best || p.d > best.d)) best = { d: p.d, r, hole: h.hole };
  if (!best) return null;
  return {
    key: 'high-longest',
    title: 'Longest putt holed',
    value: `${best.d} ft`,
    where: where(best.r, best.hole),
    roundId: best.r.id,
    hole: best.hole,
    metric: 'longest',
  };
}

/** The most strokes over par on one hole, then the most strokes. */
function worstHole(all: Round[]): Trophy | null {
  let worst: { over: number; strokes: number; par: number; r: Round; hole: number } | null = null;
  for (const r of rounds(all))
    for (const h of r.holes) {
      const over = holeVsPar(h);
      if (over === undefined || h.par === undefined) continue;
      const strokes = h.par + over;
      if (!worst || over > worst.over) worst = { over, strokes, par: h.par, r, hole: h.hole };
    }
  if (!worst || worst.over < 2) return null;
  return {
    key: 'low-hole',
    title: 'Highest score on a hole',
    value: `${worst.strokes} on a par ${worst.par}`,
    where: where(worst.r, worst.hole),
    roundId: worst.r.id,
    hole: worst.hole,
  };
}

function mostOnOneHole(all: Round[]): Trophy | null {
  let worst: { n: number; r: Round; hole: number; first: number } | null = null;
  for (const r of rounds(all))
    for (const h of r.holes)
      if (h.putts.length >= 3 && (!worst || h.putts.length > worst.n))
        worst = { n: h.putts.length, r, hole: h.hole, first: h.putts[0].d };
  if (!worst) return null;
  return {
    key: 'low-puttshole',
    title: 'Most putts on one hole',
    value: `${worst.n} putts from ${worst.first} ft`,
    where: where(worst.r, worst.hole),
    roundId: worst.r.id,
    hole: worst.hole,
  };
}

function shortestMiss(all: Round[]): Trophy | null {
  let worst: { d: number; r: Round; hole: number } | null = null;
  for (const r of rounds(all))
    for (const h of r.holes)
      for (const p of h.putts) if (!p.made && (!worst || p.d < worst.d)) worst = { d: p.d, r, hole: h.hole };
  if (!worst) return null;
  return {
    key: 'low-miss',
    title: 'Shortest miss',
    value: `${worst.d} ft`,
    where: where(worst.r, worst.hole),
    roundId: worst.r.id,
    hole: worst.hole,
  };
}

function mostThrees(all: Round[]): Trophy | null {
  let worst: { n: number; r: Round } | null = null;
  for (const r of rounds(all)) {
    const n = r.holes.filter((h) => h.putts.length >= 3).length;
    if (n && (!worst || n > worst.n)) worst = { n, r };
  }
  if (!worst) return null;
  return {
    key: 'low-threes',
    title: 'Most three-putts in a round',
    value: `${worst.n}`,
    where: where(worst.r),
    roundId: worst.r.id,
  };
}

export function trophyRoom(all: Round[], baseline: [number, number][]) {
  const highs = [
    fromMetric(all, baseline, 'sg', 'Best putting round', false),
    fromMetric(all, baseline, 'putts', 'Fewest putts, 18 holes', false, 18),
    fromMetric(all, baseline, 'putts', 'Fewest putts, 9 holes', false, 9),
    fromMetric(all, baseline, 'score', 'Lowest score, 18 holes', false, 18),
    longestMake(all),
    noThreeRun(all),
    onePuttRun(all),
    fromMetric(all, baseline, 'ones', 'Most one-putts, 18 holes', false, 18),
    fromMetric(all, baseline, 'feet', 'Most feet holed, 18 holes', false, 18),
    fromMetric(all, baseline, 'scoring', 'Best from 3 to 10 ft', false),
    fromMetric(all, baseline, 'lag', 'Best lag putting', false),
    fromMetric(all, baseline, 'greens', 'Most greens hit, 18 holes', false, 18),
    fromMetric(all, baseline, 'birdies', 'Most birdies, 18 holes', false, 18),
  ].filter((t): t is Trophy => t !== null);
  const lows = [
    fromMetric(all, baseline, 'sg', 'Worst putting round', true),
    fromMetric(all, baseline, 'putts', 'Most putts, 18 holes', true, 18),
    mostThrees(all),
    mostOnOneHole(all),
    worstHole(all),
    shortestMiss(all),
    fromMetric(all, baseline, 'score', 'Highest score, 18 holes', true, 18),
  ].filter((t): t is Trophy => t !== null);
  return { highs, lows };
}
