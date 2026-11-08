import { fmtDate, signed } from './format';
import { puttSG } from './sg';
import { breakDirsOf, holeVsPar, holedOut, type BreakDir, type Hole, type Putt, type Round } from './types';

/**
 * Moments, ranked on one measure: the odds of doing this in a round, given the putts you actually
 * faced, by your own make chances.
 *
 * One currency is what lets a streak compete with an eagle. Each detector works out the chance
 * that a round with these putts produces at least this result:
 * - One putt that dropped: the chance that at least one putt as long a shot went in. Three putts
 *   under 3% in a round make a 2% make roughly 1 in 26, not 1 in 50.
 * - A run, a count, a total: worked out exactly over every hole's make chance.
 * - A miss: the chance that at least one putt as makeable stayed out.
 * - Scores the putting model cannot see (eagle, chip-in) use your own rate across rounds, which
 *   full game will replace with an approach model. An ace or an albatross always leads.
 *
 * Anything at 1 in 10 rounds or rarer is a moment. There is no cap, and a round can have none.
 */
export type MomentViz =
  | { t: 'line'; dirs: BreakDir[] }
  | { t: 'bars'; bars: { v: number; label: string; me: boolean }[] }
  | { t: 'dots'; holes: { hole: number; chance: number; made: boolean }[] }
  | { t: 'lag'; from: number; leave: number }
  | { t: 'streak'; holes: { hole: number; one: boolean }[] };

export interface Moment {
  kind: string;
  /** Chance of this in a round with these putts. Lower is bigger. */
  p: number;
  odds: string;
  low?: boolean;
  label: string;
  tag?: string;
  big: string;
  unit?: string;
  line: string;
  stats: { v: string; l: string; tone?: 'good' | 'bad' | 'accent' }[];
  hole?: number;
  viz?: MomentViz;
}

type ChanceOf = (p: Putt) => number | null;

interface Ctx {
  round: Round;
  prior: Round[];
  baseline: [number, number][];
  chance: (p: Putt) => number;
  three: (d: number) => number;
}

type Detector = (c: Ctx) => Moment | null;

export const MOMENT_LINE = 0.1;
/** Past the longest putt the model has seen it will not answer, and those are lag putts. */
const BEYOND = 0.003;

const pctWord = (c: number) => (c < 0.01 ? 'under 1%' : `${Math.round(c * 100)}%`);

export function oddsText(p: number): string {
  if (p <= 0) return 'Career';
  const n = 1 / p;
  if (n >= 1000) return '1 in 1,000+';
  const r = n < 20 ? Math.round(n) : n < 100 ? Math.round(n / 5) * 5 : Math.round(n / 50) * 50;
  return `1 in ${r.toLocaleString('en-US')}`;
}

export function resultWord(vs: number | undefined): string | undefined {
  if (vs === undefined) return undefined;
  return ['Albatross', 'Eagle', 'Birdie', 'Par', 'Bogey', 'Double bogey'][vs + 3] ?? `+${vs}`;
}

/** What the hole would have been if putt i had dropped. */
function forWord(h: Hole, i: number): string | undefined {
  const vs = holeVsPar(h);
  if (vs === undefined) return undefined;
  return resultWord(vs - (h.putts.length - 1 - i));
}

export function shapeWords(dirs: BreakDir[]): string {
  const l = dirs.includes('L→R');
  const r = dirs.includes('R→L');
  const side = l && r ? 'breaks both ways' : l ? 'left to right' : r ? 'right to left' : dirs.includes('straight') ? 'straight' : '';
  const slope = dirs.includes('uphill') ? 'Uphill' : dirs.includes('downhill') ? 'Downhill' : '';
  if (slope && side) return `${slope}, ${side}.`;
  if (slope) return `${slope}.`;
  return side ? `${side[0].toUpperCase()}${side.slice(1)}.` : '';
}

const withPutts = (r: Round) => r.holes.filter((h) => h.putts.length > 0);
const playedCount = (r: Round) => r.holes.filter((h) => h.putts.length > 0 || holedOut(h)).length;
const totalPutts = (r: Round) => r.holes.reduce((n, h) => n + h.putts.length, 0);
const longestMake = (r: Round) => Math.max(0, ...r.holes.flatMap((h) => h.putts.filter((p) => p.made).map((p) => p.d)));
const allPutts = (r: Round) => withPutts(r).flatMap((h) => h.putts.map((p, i) => ({ h, p, i })));

/** Chance that at least one of these comes off. */
const anyOf = (ps: number[]) => 1 - ps.reduce((q, p) => q * (1 - p), 1);

/** Chance of at least k successes, worked out exactly over each one's own chance. */
export function atLeast(ps: number[], k: number): number {
  let dist = [1];
  for (const p of ps) {
    const next = new Array<number>(dist.length + 1).fill(0);
    dist.forEach((v, j) => {
      next[j] += v * (1 - p);
      next[j + 1] += v * p;
    });
    dist = next;
  }
  return dist.slice(k).reduce((a, b) => a + b, 0);
}

/** Chance of a run of at least k in a row somewhere in the sequence. */
export function runOf(ps: number[], k: number): number {
  let state = new Array<number>(k).fill(0);
  state[0] = 1;
  let done = 0;
  for (const p of ps) {
    const next = new Array<number>(k).fill(0);
    state.forEach((v, j) => {
      next[0] += v * (1 - p);
      if (j + 1 >= k) done += v * p;
      else next[j + 1] += v * p;
    });
    state = next;
  }
  return done;
}

/** Chance of this many putts or fewer, from each hole's one-putt and three-putt chances. */
export function puttsAtMost(holes: { one: number; three: number }[], max: number): number {
  let dist = [1];
  for (const { one, three } of holes) {
    const two = Math.max(0, 1 - one - three);
    const next = new Array<number>(dist.length + 3).fill(0);
    dist.forEach((v, t) => {
      next[t + 1] += v * one;
      next[t + 2] += v * two;
      next[t + 3] += v * three;
    });
    dist = next;
  }
  return dist.slice(0, max + 1).reduce((a, b) => a + b, 0);
}

/** Three-putt rate by first-putt distance from your rounds, pulled toward a typical rate when thin. */
function threeRates(rounds: Round[]) {
  const bands = [
    { to: 5, typical: 0.01 },
    { to: 10, typical: 0.02 },
    { to: 20, typical: 0.04 },
    { to: 30, typical: 0.08 },
    { to: 45, typical: 0.13 },
    { to: Infinity, typical: 0.2 },
  ].map((b) => ({ ...b, n: 0, threes: 0 }));
  for (const r of rounds)
    for (const h of withPutts(r)) {
      const b = bands.find((x) => h.putts[0].d <= x.to)!;
      b.n++;
      if (h.putts.length >= 3) b.threes++;
    }
  const PULL = 10;
  return (d: number) => {
    const b = bands.find((x) => d <= x.to)!;
    return (b.threes + b.typical * PULL) / (b.n + PULL);
  };
}

/**
 * How often a score happens across your rounds. The first one you log has no rate to speak of, so
 * it ranks with the biggest moments and says it is a first instead of printing made-up odds.
 */
const FIRST = 0.005;
function rateIn(prior: Round[], has: (r: Round) => boolean) {
  const before = prior.filter(has).length;
  return before ? { p: (before + 0.5) / (prior.length + 1), first: false } : { p: FIRST, first: true };
}

function finishLine(h: Hole): string {
  if (holedOut(h)) return 'Holed from off the green.';
  const last = h.putts[h.putts.length - 1];
  return last?.made ? `Holed from ${last.d} ft.` : '';
}

const scoring: Detector = ({ round, prior }) => {
  const best = round.holes
    .map((h) => ({ h, vs: holeVsPar(h) }))
    .filter((x): x is { h: Hole; vs: number } => x.vs !== undefined && x.vs <= -2)
    .sort((a, b) => a.vs - b.vs)[0];
  if (!best) return null;
  const { h, vs } = best;
  const ace = h.strokes === 1;
  const top = ace || vs <= -3;
  const name = ace ? 'Hole in one' : vs <= -3 ? 'Albatross' : 'Eagle';
  const last = h.putts[h.putts.length - 1];
  const rate = rateIn(prior, (r) => r.holes.some((x) => (holeVsPar(x) ?? 0) <= -2));
  const p = top ? 0 : rate.p;
  return {
    kind: ace ? 'ace' : vs <= -3 ? 'albatross' : 'eagle',
    p,
    odds: top ? 'Career' : rate.first ? 'First logged' : oddsText(p),
    label: name,
    tag: `Hole ${h.hole} · Par ${h.par ?? ''}`.trim(),
    big: ace ? 'ACE' : String(h.strokes ?? ''),
    unit: ace ? undefined : `ON A PAR ${h.par ?? ''}`.trim(),
    line: top || rate.first ? finishLine(h) || `${name} on ${h.hole}.` : `${finishLine(h)} Odds from your ${prior.length} rounds before this one.`.trim(),
    stats: [{ v: String(vs), l: 'to par on the hole', tone: 'accent' }],
    hole: h.hole,
    viz: last?.made ? { t: 'line', dirs: breakDirsOf(last) } : undefined,
  };
};

const chipIn: Detector = ({ round, prior }) => {
  const h = round.holes.find((x) => holedOut(x) && (holeVsPar(x) ?? 0) > -2);
  if (!h) return null;
  const rate = rateIn(prior, (r) => r.holes.some(holedOut));
  const word = resultWord(holeVsPar(h));
  return {
    kind: 'chipIn',
    p: rate.p,
    odds: rate.first ? 'First logged' : oddsText(rate.p),
    label: 'Chip-in',
    tag: word ? `${word} on ${h.hole}` : `Hole ${h.hole}`,
    big: '0',
    unit: 'PUTTS',
    line: rate.first ? 'Holed from off the green. Your first chip-in logged.' : `Holed from off the green. Odds from your ${prior.length} rounds before this one.`,
    stats: [{ v: String(prior.filter((r) => r.holes.some(holedOut)).length), l: 'chip-ins before it' }],
    hole: h.hole,
  };
};

const longshot: Detector = ({ round, prior, baseline, chance }) => {
  const putts = allPutts(round).map((x) => ({ ...x, c: chance(x.p) }));
  const shot = putts.filter((x) => x.p.made && x.p.d >= 6).sort((a, b) => a.c - b.c)[0];
  if (!shot) return null;
  const p = anyOf(putts.filter((x) => x.c <= shot.c).map((x) => x.c));
  const sg = puttSG(baseline, shot.p.d, true, null);
  let farText = '';
  if (shot.p.d === longestMake(round) && prior.length >= 3) {
    const far = [...prior].sort((a, b) => b.date.localeCompare(a.date)).find((r) => longestMake(r) >= shot.p.d);
    farText = far ? `Longest make since ${fmtDate(far.date)}.` : 'Longest make you have logged.';
  }
  const word = forWord(shot.h, shot.i);
  return {
    kind: 'longshot',
    p,
    odds: oddsText(p),
    label: 'Long shot',
    tag: word ? `${word} on ${shot.h.hole}` : `Hole ${shot.h.hole}`,
    big: String(shot.p.d),
    unit: 'FT',
    line: [`Holed it. Your make chance was ${pctWord(shot.c)}.`, shapeWords(breakDirsOf(shot.p)), farText].filter(Boolean).join(' '),
    stats: [
      { v: pctWord(shot.c), l: 'your make chance', tone: 'accent' },
      ...(sg !== null ? [{ v: signed(sg), l: 'strokes gained', tone: 'good' as const }] : []),
    ],
    hole: shot.h.hole,
    viz: { t: 'line', dirs: breakDirsOf(shot.p) },
  };
};

const firstPutts = (r: Round, chance: (p: Putt) => number) =>
  withPutts(r).map((h) => ({ h, c: chance(h.putts[0]), one: h.putts.length === 1 && h.putts[0].made }));

const onePutts: Detector = ({ round, chance }) => {
  const fp = firstPutts(round, chance);
  if (fp.length < 9) return null;
  const holed = fp.filter((x) => x.one).length;
  const expected = fp.reduce((n, x) => n + x.c, 0);
  if (holed < expected + 1) return null;
  const p = atLeast(
    fp.map((x) => x.c),
    holed,
  );
  return {
    kind: 'onePutts',
    p,
    odds: oddsText(p),
    label: 'Beat the number',
    tag: `${fp.length} first putts`,
    big: String(holed),
    unit: holed === 1 ? 'ONE-PUTT' : 'ONE-PUTTS',
    line: `Your make chances on those first putts added up to ${expected.toFixed(1)}.`,
    stats: [
      { v: expected.toFixed(1), l: 'expected' },
      { v: signed(holed - expected, 1), l: 'above it', tone: 'accent' },
    ],
    viz: fp.length <= 9 ? { t: 'dots', holes: fp.map((x) => ({ hole: x.h.hole, chance: x.c, made: x.one })) } : undefined,
  };
};

const streak: Detector = ({ round, chance }) => {
  const fp = firstPutts(round, chance);
  let best = { len: 0, from: 0, to: 0 };
  let run = 0;
  fp.forEach((x, i) => {
    run = x.one ? run + 1 : 0;
    if (run > best.len) best = { len: run, from: fp[i - run + 1].h.hole, to: x.h.hole };
  });
  if (best.len < 3) return null;
  const p = runOf(
    fp.map((x) => x.c),
    best.len,
  );
  return {
    kind: 'streak',
    p,
    odds: oddsText(p),
    label: 'Hot stretch',
    tag: `Holes ${best.from} to ${best.to}`,
    big: String(best.len),
    unit: 'IN A ROW',
    line: `One-putts on ${best.len} straight holes. The odds count every hole's make chance, not just these.`,
    stats: [{ v: String(best.len), l: 'one-putts in a row' }],
    viz: { t: 'streak', holes: fp.map((x) => ({ hole: x.h.hole, one: x.h.hole >= best.from && x.h.hole <= best.to })) },
  };
};

const fewest: Detector = ({ round, prior, chance, three }) => {
  const fp = firstPutts(round, chance);
  if (fp.length < 9) return null;
  const n = playedCount(round);
  const mine = totalPutts(round);
  const p = puttsAtMost(
    fp.map((x) => ({ one: x.c, three: three(x.h.putts[0].d) })),
    mine,
  );
  const totals = prior
    .filter((r) => playedCount(r) === n)
    .map(totalPutts)
    .sort((a, b) => a - b);
  const newBest = totals.length >= 3 && mine < totals[0];
  return {
    kind: 'fewest',
    p,
    odds: oddsText(p),
    label: newBest ? 'New best' : 'Few putts',
    tag: `${n} holes`,
    big: String(mine),
    unit: 'PUTTS',
    line: newBest
      ? `Fewest you have taken over ${n} holes. The old best was ${totals[0]}.`
      : `${mine} putts on the first putts you faced. Your make chances put ${mine} or fewer at ${oddsText(p)} rounds.`,
    stats: [
      { v: String(fp.filter((x) => x.one).length), l: 'one-putts' },
      { v: String(withPutts(round).filter((h) => h.putts.length >= 3).length), l: 'three-putts' },
    ],
    viz:
      totals.length >= 3
        ? { t: 'bars', bars: [{ v: mine, label: fmtDate(round.date), me: true }, ...totals.slice(0, 4).map((v, i) => ({ v, label: i === 0 ? (newBest ? 'old best' : 'your best') : `#${i + 1}`, me: false }))] }
        : undefined,
  };
};

const clean: Detector = ({ round, chance, three }) => {
  const fp = firstPutts(round, chance);
  if (fp.length < 9 || fp.some((x) => x.h.putts.length >= 3)) return null;
  const p = fp.reduce((q, x) => q * (1 - three(x.h.putts[0].d)), 1);
  const long = fp.filter((x) => x.h.putts[0].d >= 30).length;
  return {
    kind: 'clean',
    p,
    odds: oddsText(p),
    label: 'Clean card',
    big: '0',
    unit: 'THREE-PUTTS',
    line: `${long} first ${long === 1 ? 'putt' : 'putts'} from 30 ft and out, the longest ${Math.max(...fp.map((x) => x.h.putts[0].d))} ft, and two putts or fewer on every hole.`,
    stats: [{ v: String(totalPutts(round)), l: 'putts' }],
  };
};

const lag: Detector = ({ round, prior, baseline }) => {
  const lagsOf = (r: Round) =>
    withPutts(r)
      .filter((h) => h.putts.length >= 2 && h.putts[0].d >= 25)
      .map((h) => ({ h, from: h.putts[0].d, leave: h.putts[1].d, ratio: h.putts[1].d / h.putts[0].d }));
  const mine = lagsOf(round);
  const best = [...mine].sort((a, b) => a.ratio - b.ratio)[0];
  const others = prior.flatMap(lagsOf);
  if (!best || others.length < 10) return null;
  const asClose = others.filter((l) => l.ratio <= best.ratio).length;
  const q = (asClose + 0.5) / (others.length + 1);
  const p = anyOf(mine.map(() => q));
  const sg = puttSG(baseline, best.from, false, best.leave);
  const word = resultWord(holeVsPar(best.h));
  return {
    kind: 'lag',
    p,
    odds: oddsText(p),
    label: 'Lag of the round',
    tag: word ? `Hole ${best.h.hole} · ${word}` : `Hole ${best.h.hole}`,
    big: String(best.from),
    unit: `→ ${best.leave} FT`,
    line: [shapeWords(breakDirsOf(best.h.putts[0])), `${asClose} of your ${others.length} lags before this finished as close for the length.`].filter(Boolean).join(' '),
    stats: [
      ...(sg !== null ? [{ v: signed(sg), l: 'strokes gained', tone: 'good' as const }] : []),
      { v: String(best.h.putts.length), l: 'putts' },
    ],
    hole: best.h.hole,
    viz: { t: 'lag', from: best.from, leave: best.leave },
  };
};

const gotAway: Detector = ({ round, baseline, chance }) => {
  const putts = allPutts(round).map((x) => ({ ...x, c: chance(x.p) }));
  const miss = putts.filter((x) => !x.p.made).sort((a, b) => b.c - a.c)[0];
  if (!miss) return null;
  const p = anyOf(putts.filter((x) => x.c >= miss.c).map((x) => 1 - x.c));
  const leave = miss.h.putts[miss.i + 1]?.d ?? null;
  const sg = puttSG(baseline, miss.p.d, false, leave);
  const word = forWord(miss.h, miss.i);
  return {
    kind: 'gotAway',
    p,
    odds: oddsText(p),
    low: true,
    label: 'The one that got away',
    tag: word ? `For ${word.toLowerCase()} on ${miss.h.hole}` : `Hole ${miss.h.hole}`,
    big: String(miss.p.d),
    unit: 'FT',
    line: [`Missed. Your make chance was ${pctWord(miss.c)}.`, shapeWords(breakDirsOf(miss.p))].filter(Boolean).join(' '),
    stats: [
      { v: pctWord(miss.c), l: 'your make chance' },
      ...(sg !== null ? [{ v: signed(sg), l: 'strokes gained', tone: 'bad' as const }] : []),
    ],
    hole: miss.h.hole,
    viz: { t: 'line', dirs: breakDirsOf(miss.p) },
  };
};

const DETECTORS: Detector[] = [scoring, chipIn, longshot, onePutts, streak, fewest, clean, lag, gotAway];

export function momentsOf(round: Round, rounds: Round[], baseline: [number, number][], chanceOf: ChanceOf): Moment[] {
  if (round.practice) return [];
  const prior = rounds.filter((r) => r.id !== round.id && !r.practice && r.date < round.date && withPutts(r).length);
  const ctx: Ctx = { round, prior, baseline, chance: (p) => chanceOf(p) ?? BEYOND, three: threeRates(prior) };
  return DETECTORS.map((d) => d(ctx))
    .filter((m): m is Moment => m !== null && m.p <= MOMENT_LINE)
    .sort((a, b) => a.p - b.p);
}

/** Every round's moments, newest round first, for the reel. */
export function allMoments(rounds: Round[], baseline: [number, number][], chanceOf: ChanceOf) {
  return rounds
    .filter((r) => !r.practice && withPutts(r).length)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((round) => momentsOf(round, rounds, baseline, chanceOf).map((m) => ({ round, m })));
}
