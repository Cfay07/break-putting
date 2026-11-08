import { fmtDate, signed } from './format';
import { puttSG } from './sg';
import { breakDirsOf, holeVsPar, holedOut, type BreakDir, type Hole, type Putt, type Round } from './types';

/**
 * The few things from one round worth looking at twice.
 *
 * Rarity comes from one of three places, and every detector says which:
 * - The event is rare in golf itself: an ace, an albatross, an eagle, a chip-in. Fixed at the top.
 * - The app's own chance for it was low: a 2% make, or a 90% miss.
 * - It is rare against your own rounds: a new best, or the first time since a date.
 *
 * Each detector looks at one round plus the rounds before it and returns at most one moment.
 * Full game and swing add detectors here; the ranking, the cards and the reel stay as they are.
 * Nothing is invented: every card is a putt, a score or a comparison the player logged.
 */
export type MomentViz =
  | { t: 'line'; dirs: BreakDir[] }
  | { t: 'bars'; bars: { v: number; label: string; me: boolean }[] }
  | { t: 'dots'; holes: { hole: number; chance: number; made: boolean }[] }
  | { t: 'lag'; from: number; leave: number }
  | { t: 'streak'; holes: { hole: number; one: boolean }[] };

export interface Moment {
  kind: string;
  /** 0 to 1. Above 0.97 is reserved for events that are rare in golf itself. */
  rarity: number;
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
  chanceOf: ChanceOf;
}

type Detector = (c: Ctx) => Moment | null;

export const MOMENTS_PER_ROUND = 3;

const pctWord = (c: number) => (c < 0.01 ? 'under 1%' : `${Math.round(c * 100)}%`);

export function resultWord(h: Hole): string | undefined {
  const vs = holeVsPar(h);
  if (vs === undefined) return undefined;
  return ['Albatross', 'Eagle', 'Birdie', 'Par', 'Bogey', 'Double bogey'][vs + 3] ?? `+${vs}`;
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

/** Most recent earlier round that matched or beat this, and how many rounds have gone by since. */
function since(prior: Round[], beats: (r: Round) => boolean) {
  const newestFirst = [...prior].sort((a, b) => b.date.localeCompare(a.date));
  const i = newestFirst.findIndex(beats);
  return i < 0 ? { ever: true, gap: newestFirst.length, date: '' } : { ever: false, gap: i, date: newestFirst[i].date };
}

const gapRarity = (gap: number) => 1 - 1 / (gap + 1);

function finishLine(h: Hole): string {
  if (holedOut(h)) return 'Holed from off the green.';
  const last = h.putts[h.putts.length - 1];
  return last?.made ? `Holed from ${last.d} ft.` : '';
}

/** Scores that are rare in golf itself, best one per round. */
const scoring: Detector = ({ round }) => {
  const best = round.holes
    .map((h) => ({ h, vs: holeVsPar(h) }))
    .filter((x): x is { h: Hole; vs: number } => x.vs !== undefined && x.vs <= -2)
    .sort((a, b) => a.vs - b.vs || (a.h.strokes ?? 9) - (b.h.strokes ?? 9))[0];
  if (!best) return null;
  const { h, vs } = best;
  const ace = h.strokes === 1;
  const last = h.putts[h.putts.length - 1];
  const name = ace ? 'Hole in one' : vs <= -3 ? 'Albatross' : 'Eagle';
  return {
    kind: ace ? 'ace' : vs <= -3 ? 'albatross' : 'eagle',
    rarity: ace ? 1 : vs <= -3 ? 0.995 : 0.985,
    label: name,
    tag: `Hole ${h.hole} · Par ${h.par ?? ''}`.trim(),
    big: ace ? 'ACE' : String(h.strokes ?? ''),
    unit: ace ? undefined : `ON A PAR ${h.par ?? ''}`.trim(),
    line: [finishLine(h), ace ? 'One swing.' : ''].filter(Boolean).join(' ') || `${name} on ${h.hole}.`,
    stats: [{ v: String(vs), l: 'to par on the hole', tone: 'accent' }],
    hole: h.hole,
    viz: last?.made ? { t: 'line', dirs: breakDirsOf(last) } : undefined,
  };
};

const chipIn: Detector = ({ round, prior }) => {
  const h = round.holes.find((x) => holedOut(x) && (holeVsPar(x) ?? 0) > -2);
  if (!h) return null;
  const last = since(prior, (r) => r.holes.some(holedOut));
  const word = resultWord(h);
  return {
    kind: 'chipIn',
    rarity: Math.max(0.9, last.ever ? 0.96 : gapRarity(last.gap)),
    label: 'Chip-in',
    tag: word ? `${word} on ${h.hole}` : `Hole ${h.hole}`,
    big: '0',
    unit: 'PUTTS',
    line: last.ever ? 'Holed from off the green. Your first chip-in logged.' : `Holed from off the green. First since ${fmtDate(last.date)}.`,
    stats: [{ v: last.ever ? 'First' : String(last.gap), l: last.ever ? 'chip-in logged' : 'rounds since the last' }],
    hole: h.hole,
  };
};

const longshot: Detector = ({ round, prior, baseline, chanceOf }) => {
  const shot = withPutts(round)
    .flatMap((h) => h.putts.flatMap((p, i) => (p.made ? [{ h, p, i, c: chanceOf(p) }] : [])))
    .filter((m) => m.c !== null && m.p.d >= 6 && m.c <= 0.35)
    .sort((a, b) => a.c! - b.c!)[0];
  if (!shot) return null;
  const word = resultWord(shot.h);
  const sg = puttSG(baseline, shot.p.d, true, null);
  const far = shot.p.d === longestMake(round) && prior.length >= 3 ? since(prior, (r) => longestMake(r) >= shot.p.d) : null;
  const farText = far ? (far.ever ? 'Longest make you have logged.' : far.gap >= 3 ? `Longest make since ${fmtDate(far.date)}.` : '') : '';
  return {
    kind: 'longshot',
    rarity: Math.min(0.97, 1 - shot.c!),
    label: 'Long shot',
    tag: word && shot.i === shot.h.putts.length - 1 ? `${word} on ${shot.h.hole}` : `Hole ${shot.h.hole}`,
    big: String(shot.p.d),
    unit: 'FT',
    line: [`Holed it. Your make chance was ${pctWord(shot.c!)}.`, shapeWords(breakDirsOf(shot.p)), farText].filter(Boolean).join(' '),
    stats: [
      { v: pctWord(shot.c!), l: 'your make chance', tone: 'accent' },
      ...(sg !== null ? [{ v: signed(sg), l: 'strokes gained', tone: 'good' as const }] : []),
    ],
    hole: shot.h.hole,
    viz: { t: 'line', dirs: breakDirsOf(shot.p) },
  };
};

const longest: Detector = ({ round, prior, chanceOf }) => {
  const far = longestMake(round);
  if (far < 10 || prior.length < 3) return null;
  const s = since(prior, (r) => longestMake(r) >= far);
  if (!s.ever && s.gap < 3) return null;
  const h = withPutts(round).find((x) => x.putts.some((p) => p.made && p.d === far))!;
  const p = h.putts.find((x) => x.made && x.d === far)!;
  const c = chanceOf(p);
  return {
    kind: 'longest',
    rarity: s.ever ? 0.95 : gapRarity(s.gap) * 0.95,
    label: s.ever ? 'New best' : 'Longest in a while',
    tag: `Hole ${h.hole}`,
    big: String(far),
    unit: 'FT',
    line: [s.ever ? 'Longest make you have logged.' : `Longest make since ${fmtDate(s.date)}.`, shapeWords(breakDirsOf(p))].filter(Boolean).join(' '),
    stats: [
      ...(c !== null ? [{ v: pctWord(c), l: 'your make chance', tone: 'accent' as const }] : []),
      { v: String(s.gap), l: s.ever ? 'rounds before it' : 'rounds since' },
    ],
    hole: h.hole,
    viz: { t: 'line', dirs: breakDirsOf(p) },
  };
};

const fewest: Detector = ({ round, prior }) => {
  const n = playedCount(round);
  if (n !== 9 && n !== 18) return null;
  const same = prior.filter((r) => playedCount(r) === n);
  if (same.length < 3) return null;
  const mine = totalPutts(round);
  const s = since(same, (r) => totalPutts(r) <= mine);
  if (!s.ever && s.gap < 3) return null;
  const totals = same.map(totalPutts).sort((a, b) => a - b);
  const word = n === 9 ? 'nine' : 'eighteen';
  return {
    kind: 'fewest',
    rarity: s.ever ? 0.96 : gapRarity(s.gap),
    label: s.ever ? 'New best' : 'Fewest in a while',
    tag: `${n} holes`,
    big: String(mine),
    unit: 'PUTTS',
    line: s.ever
      ? `Fewest you have taken over ${word} holes. The old best was ${totals[0]}.`
      : `Fewest over ${word} since ${fmtDate(s.date)}. Your best is ${totals[0]}.`,
    stats: [
      { v: String(withPutts(round).filter((h) => h.putts.length === 1).length), l: 'one-putts' },
      { v: String(withPutts(round).filter((h) => h.putts.length >= 3).length), l: 'three-putts' },
    ],
    viz: {
      t: 'bars',
      bars: [
        { v: mine, label: fmtDate(round.date), me: true },
        ...totals.slice(0, 4).map((v, i) => ({ v, label: s.ever && i === 0 ? 'old best' : `#${i + (s.ever ? 2 : 1)}`, me: false })),
      ],
    },
  };
};

function beatOf(r: Round, chanceOf: ChanceOf) {
  let expected = 0;
  let holed = 0;
  const holes: { hole: number; chance: number; made: boolean }[] = [];
  for (const h of withPutts(r)) {
    const c = chanceOf(h.putts[0]);
    if (c === null) continue;
    expected += c;
    const made = h.putts.length === 1 && h.putts[0].made;
    if (made) holed++;
    holes.push({ hole: h.hole, chance: c, made });
  }
  return { expected, holed, n: holes.length, holes, diff: holed - expected };
}

const beat: Detector = ({ round, prior, chanceOf }) => {
  const b = beatOf(round, chanceOf);
  if (b.n < 9 || b.diff < 1 || prior.length < 5) return null;
  const others = prior.map((r) => beatOf(r, chanceOf)).filter((x) => x.n >= 9);
  const rank = others.length ? others.filter((x) => x.diff < b.diff).length / others.length : 0;
  if (rank < 0.6) return null;
  return {
    kind: 'beat',
    rarity: rank * 0.96,
    label: 'Beat the number',
    tag: 'First putts',
    big: String(b.holed),
    unit: b.holed === 1 ? 'ONE-PUTT' : 'ONE-PUTTS',
    line: `Your make chances on those ${b.n} first putts added up to ${b.expected.toFixed(1)}.`,
    stats: [
      { v: b.expected.toFixed(1), l: 'expected' },
      { v: signed(b.diff, 1), l: 'above it', tone: 'accent' },
    ],
    viz: b.holes.length <= 9 ? { t: 'dots', holes: b.holes } : undefined,
  };
};

const lagsOf = (r: Round) =>
  withPutts(r)
    .filter((h) => h.putts.length >= 2 && h.putts[0].d >= 25)
    .map((h) => ({ h, from: h.putts[0].d, leave: h.putts[1].d }));

const lag: Detector = ({ round, prior, baseline }) => {
  const best = lagsOf(round).sort((a, b) => a.leave / a.from - b.leave / b.from)[0];
  if (!best || best.leave > 3) return null;
  const others = prior.flatMap(lagsOf);
  if (others.length < 10) return null;
  const rank = others.filter((l) => l.leave / l.from > best.leave / best.from).length / others.length;
  if (rank < 0.6) return null;
  const sg = puttSG(baseline, best.from, false, best.leave);
  const word = resultWord(best.h);
  return {
    kind: 'lag',
    rarity: rank * 0.9,
    label: 'Lag of the round',
    tag: word ? `Hole ${best.h.hole} · ${word}` : `Hole ${best.h.hole}`,
    big: String(best.from),
    unit: `→ ${best.leave} FT`,
    line: [shapeWords(breakDirsOf(best.h.putts[0])), rank >= 0.99 ? 'Your closest lag from 25 ft and out so far.' : `Closer than ${Math.round(rank * 100)}% of your lags from 25 ft and out.`].filter(Boolean).join(' '),
    stats: [
      ...(sg !== null ? [{ v: signed(sg), l: 'strokes gained', tone: 'good' as const }] : []),
      { v: String(best.h.putts.length), l: 'putts' },
    ],
    hole: best.h.hole,
    viz: { t: 'lag', from: best.from, leave: best.leave },
  };
};

function bestStreak(r: Round) {
  let best = { len: 0, from: 0, to: 0 };
  let run = 0;
  let start = 0;
  for (const h of r.holes) {
    if (h.putts.length === 1 && h.putts[0].made) {
      if (!run) start = h.hole;
      run++;
      if (run > best.len) best = { len: run, from: start, to: h.hole };
    } else if (h.putts.length || holedOut(h)) {
      run = 0;
    }
  }
  return best;
}

const streak: Detector = ({ round, prior }) => {
  const run = bestStreak(round);
  if (run.len < 3 || prior.length < 5) return null;
  const s = since(prior, (r) => bestStreak(r).len >= run.len);
  if (!s.ever && s.gap < 3) return null;
  return {
    kind: 'streak',
    rarity: s.ever ? 0.94 : gapRarity(s.gap) * 0.95,
    label: 'Hot stretch',
    tag: `Holes ${run.from} to ${run.to}`,
    big: String(run.len),
    unit: 'IN A ROW',
    line: s.ever
      ? `One-putts on ${run.len} straight holes. Your longest run yet.`
      : `One-putts on ${run.len} straight holes. Longest run since ${fmtDate(s.date)}.`,
    stats: [{ v: String(run.len), l: 'one-putts in a row' }],
    viz: { t: 'streak', holes: withPutts(round).map((h) => ({ hole: h.hole, one: h.hole >= run.from && h.hole <= run.to })) },
  };
};

const clean: Detector = ({ round, prior }) => {
  if (withPutts(round).some((h) => h.putts.length >= 3) || playedCount(round) < 9 || prior.length < 5) return null;
  const had = prior.filter((r) => withPutts(r).some((h) => h.putts.length >= 3)).length;
  const share = had / prior.length;
  if (share < 0.6) return null;
  return {
    kind: 'clean',
    rarity: share * 0.85,
    label: 'Clean card',
    big: '0',
    unit: 'THREE-PUTTS',
    line: `${had} of your ${prior.length} rounds before this had one.`,
    stats: [{ v: String(totalPutts(round)), l: 'putts' }],
  };
};

const gotAway: Detector = ({ round, baseline, chanceOf }) => {
  const miss = withPutts(round)
    .flatMap((h) => h.putts.flatMap((p, i) => (!p.made ? [{ h, p, i, c: chanceOf(p) }] : [])))
    .filter((m) => m.c !== null && m.c >= 0.8)
    .sort((a, b) => b.c! - a.c!)[0];
  if (!miss) return null;
  const leave = miss.h.putts[miss.i + 1]?.d ?? null;
  const sg = puttSG(baseline, miss.p.d, false, leave);
  return {
    kind: 'gotAway',
    rarity: miss.c! * 0.8,
    low: true,
    label: 'The one that got away',
    tag: `Hole ${miss.h.hole}`,
    big: String(miss.p.d),
    unit: 'FT',
    line: [`Missed. Your make chance was ${pctWord(miss.c!)}.`, shapeWords(breakDirsOf(miss.p))].filter(Boolean).join(' '),
    stats: [
      { v: pctWord(miss.c!), l: 'your make chance' },
      ...(sg !== null ? [{ v: signed(sg), l: 'strokes gained', tone: 'bad' as const }] : []),
    ],
    hole: miss.h.hole,
    viz: { t: 'line', dirs: breakDirsOf(miss.p) },
  };
};

const DETECTORS: Detector[] = [scoring, chipIn, longshot, longest, fewest, beat, lag, streak, clean, gotAway];

export function momentsOf(round: Round, rounds: Round[], baseline: [number, number][], chanceOf: ChanceOf): Moment[] {
  if (round.practice) return [];
  const prior = rounds.filter((r) => r.id !== round.id && !r.practice && r.date < round.date && withPutts(r).length);
  const found = DETECTORS.map((d) => d({ round, prior, baseline, chanceOf }))
    .filter((m): m is Moment => m !== null)
    .sort((a, b) => b.rarity - a.rarity);
  const shown: Moment[] = [];
  for (const m of found) {
    if (shown.length === MOMENTS_PER_ROUND) break;
    // One card per hole, and at most one lowlight, so three cards are three different things.
    if (m.hole !== undefined && shown.some((x) => x.hole === m.hole)) continue;
    if (m.low && shown.some((x) => x.low)) continue;
    shown.push(m);
  }
  return shown;
}

/** Every round's moments, newest round first, for the reel. */
export function allMoments(rounds: Round[], baseline: [number, number][], chanceOf: ChanceOf) {
  return rounds
    .filter((r) => !r.practice && withPutts(r).length)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((round) => momentsOf(round, rounds, baseline, chanceOf).map((m) => ({ round, m })));
}

