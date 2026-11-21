import { bleedSummary } from './bleed';
import type { GroupLine } from './situations';
import { lagSaves } from './stats';
import { GREEN_SPEEDS, type GreenSpeed, type Putter, type Round } from './types';

/**
 * The answer line on top of each "When it changes" page, and the splits under it. Every split is
 * read one putter at a time, because the switch to a better putter moved every number at once and
 * would otherwise pass for green speed, nerves or anything else that changed in the same months.
 */

export interface Tally {
  made: number;
  tried: number;
}

/** How sure a gap is: clear at about 95%, a lean at about 68%, otherwise nothing to say. */
export type Verdict = 'clear' | 'lean' | 'none';

/** Putts each side needs before two make rates are compared at all. */
export const MIN_PUTTS = 20;

const pct = (t: Tally) => Math.round((t.made / t.tried) * 100);
const verdictOf = (z: number): Verdict => (Math.abs(z) >= 1.96 ? 'clear' : Math.abs(z) >= 1 ? 'lean' : 'none');

/** Two-proportion test. Positive z means a makes more than b. */
export function compareRates(a: Tally, b: Tally): { verdict: Verdict; better: boolean } {
  const none = { verdict: 'none' as const, better: false };
  if (a.tried < MIN_PUTTS || b.tried < MIN_PUTTS) return none;
  const p = (a.made + b.made) / (a.tried + b.tried);
  if (p === 0 || p === 1) return none;
  const z = (a.made / a.tried - b.made / b.tried) / Math.sqrt(p * (1 - p) * (1 / a.tried + 1 / b.tried));
  return { verdict: verdictOf(z), better: z > 0 };
}

const real = (rounds: Round[]) => rounds.filter((r) => r.finished && !r.practice);

function between(rounds: Round[], lo: number, hi: number): Tally {
  const ps = rounds.flatMap((r) => r.holes.flatMap((h) => h.putts)).filter((p) => p.d >= lo && p.d <= hi);
  return { made: ps.filter((p) => p.made).length, tried: ps.length };
}

const lagTally = (rounds: Round[]): Tally => {
  const l = lagSaves(rounds);
  return { made: l.good, tried: l.lags };
};

// By putter

export const PUTTER_BANDS = [
  { label: '3 to 5 ft', lo: 3, hi: 5 },
  { label: '6 to 8 ft', lo: 6, hi: 8 },
  { label: '9 to 15 ft', lo: 9, hi: 15 },
];

export interface PutterLine {
  putter: Putter;
  rounds: number;
  bands: Tally[];
  lags: Tally;
  comebacks: Tally;
}

/** The two putters used most lately, older first, read over the same distances. */
export function putterPair(rounds: Round[], putters: Putter[]): [PutterLine, PutterLine] | null {
  const rs = real(rounds);
  const lines = putters
    .map((putter) => ({ putter, rs: rs.filter((r) => r.putterId === putter.id) }))
    .filter((x) => x.rs.length > 0)
    .sort((a, b) => lastDate(a.rs).localeCompare(lastDate(b.rs)))
    .slice(-2)
    .map(({ putter, rs }) => {
      const l = lagSaves(rs);
      return {
        putter,
        rounds: rs.length,
        bands: PUTTER_BANDS.map((b) => between(rs, b.lo, b.hi)),
        lags: { made: l.good, tried: l.lags },
        comebacks: { made: l.comebacksHoled, tried: l.comebacks },
      };
    });
  return lines.length === 2 ? [lines[0], lines[1]] : null;
}

const lastDate = (rs: Round[]) => rs.reduce((m, r) => (r.date > m ? r.date : m), '');

export function putterStory([a, b]: [PutterLine, PutterLine]): string {
  const [sa, sb] = [a.bands[0], b.bands[0]];
  if (sa.tried < MIN_PUTTS || sb.tried < MIN_PUTTS)
    return `Not enough 3 to 5 ft putts with both the ${a.putter.name} and the ${b.putter.name} to compare yet.`;
  const { verdict, better } = compareRates(sb, sa);
  if (verdict === 'none')
    return `No clear difference from 3 to 5 ft between the ${a.putter.name} and the ${b.putter.name} yet.`;
  if (verdict === 'lean')
    return `From 3 to 5 ft the ${b.putter.name} leans ${better ? 'better' : 'worse'}, ${pct(sb)}% against ${pct(sa)}%. Not enough putts to call it yet.`;
  const head = `The ${b.putter.name} ${better ? 'is the change' : 'cost you'}. From 3 to 5 ft you went from ${pct(sa)}% to ${pct(sb)}%.`;
  if (a.lags.tried < MIN_PUTTS || b.lags.tried < MIN_PUTTS) return head;
  const lag = compareRates(b.lags, a.lags);
  if (lag.verdict === 'none' && Math.abs(pct(b.lags) - pct(a.lags)) <= 10)
    return `${head} Your lag pace barely moved, so it's the short stroke, not your speed.`;
  return `${head} Your lags moved too, ${pct(a.lags)}% to ${pct(b.lags)}% inside 10%.`;
}

// Greens

export interface SpeedLine {
  speed: GreenSpeed;
  rounds: number;
  short: Tally;
  lags: Tally;
}

/** Each green speed for one putter. */
export function speedLines(rounds: Round[], putterId: string): SpeedLine[] {
  const rs = real(rounds).filter((r) => r.putterId === putterId);
  return GREEN_SPEEDS.map((speed) => {
    const g = rs.filter((r) => r.greenSpeed === speed);
    return { speed, rounds: g.length, short: between(g, 3, 10), lags: lagTally(g) };
  }).filter((l) => l.rounds > 0);
}

/** The putter with the most rounds that has at least two green speeds, and its lines. */
export function greensFor(rounds: Round[], putters: Putter[]): { putter: Putter; lines: SpeedLine[] } | null {
  const rs = real(rounds);
  return (
    [...putters]
      .sort((a, b) => rs.filter((r) => r.putterId === b.id).length - rs.filter((r) => r.putterId === a.id).length)
      .map((putter) => ({ putter, lines: speedLines(rounds, putter.id) }))
      .find((x) => x.lines.length >= 2) ?? null
  );
}

/** The worst and best speed for short putts, among speeds with enough putts, and how sure the gap is. */
export function speedExtremes(lines: SpeedLine[]): { worst: SpeedLine; best: SpeedLine; verdict: Verdict } | null {
  const ok = lines.filter((l) => l.short.tried >= MIN_PUTTS);
  if (ok.length < 2) return null;
  const sorted = [...ok].sort((a, b) => a.short.made / a.short.tried - b.short.made / b.short.tried);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  return { worst, best, verdict: compareRates(worst.short, best.short).verdict };
}

export function greensStory(lines: SpeedLine[], putter: string): string | null {
  const x = speedExtremes(lines);
  if (!x) return null;
  const { worst, best, verdict } = x;
  if (verdict === 'none') return `No clear difference by green speed with the ${putter} yet.`;
  const w = worst.speed;
  const b = best.speed;
  if (verdict === 'lean')
    return `With the ${putter}, short putts lean worse on ${w} greens, ${pct(worst.short)}% against ${pct(best.short)}% on ${b} ones. Not enough putts to call it yet.`;
  const head = `With the ${putter}, you make ${pct(worst.short)}% from 3 to 10 ft on ${w} greens against ${pct(best.short)}% on ${b} ones.`;
  const lagsHold = worst.lags.tried >= 8 && best.lags.tried >= 8 && Math.abs(pct(worst.lags) - pct(best.lags)) <= 10;
  return lagsHold ? `${head} Your lags hold up on them, so it's the short ones that suffer.` : head;
}

// Tournament vs casual

export interface PressureSide {
  rounds: number;
  short: Tally;
  /** Strokes gained per 18. */
  sg: number | null;
  /** Strokes on the card a round from putting mistakes. */
  bleed: number | null;
  /** Next hole over par after a mistake, against every other hole, and how many mistakes. */
  afterOver: number | null;
  normalOver: number | null;
  mistakes: number;
  /** Putts tagged committed or not, and how many were not. Rounds that tagged any. */
  committed: Tally;
  committedRounds: number;
}

/** Mistakes needed on each side before the after-a-mistake comparison is shown. */
export const MIN_MISTAKES = 30;
/** Rounds with Committed tagged needed on each side. */
export const MIN_COMMITTED_ROUNDS = 5;

function side(rounds: Round[], line: GroupLine | undefined): PressureSide {
  const b = bleedSummary(rounds);
  const tagged = rounds.flatMap((r) => r.holes.flatMap((h) => h.putts)).filter((p) => p.uncommitted !== undefined);
  return {
    rounds: rounds.length,
    short: between(rounds, 3, 10),
    sg: line?.sg ?? null,
    bleed: b.shotsPerRound,
    afterOver: b.afterOver,
    normalOver: b.normalOver,
    mistakes: b.sample,
    committed: { made: tagged.filter((p) => !p.uncommitted).length, tried: tagged.length },
    committedRounds: rounds.filter((r) => r.holes.some((h) => h.putts.some((p) => p.uncommitted !== undefined))).length,
  };
}

export interface Pressure {
  putter: Putter;
  tournament: PressureSide;
  casual: PressureSide;
}

/**
 * Tournament against casual for the putter with the most rounds that has at least three of each.
 * `lines` is tournamentVsCasual for that putter's rounds, passed in so strokes gained is read
 * exactly as the table under it reads it.
 */
export function pressureFor(
  rounds: Round[],
  putters: Putter[],
  linesFor: (rs: Round[]) => GroupLine[],
): Pressure | null {
  const rs = real(rounds);
  const pick = putters
    .map((putter) => {
      const mine = rs.filter((r) => r.putterId === putter.id);
      return { putter, t: mine.filter((r) => r.competitive), c: mine.filter((r) => !r.competitive) };
    })
    .filter((x) => x.t.length >= 3 && x.c.length >= 3)
    .sort((a, b) => b.t.length + b.c.length - (a.t.length + a.c.length))[0];
  if (!pick) return null;
  const lines = linesFor([...pick.t, ...pick.c]);
  return {
    putter: pick.putter,
    tournament: side(
      pick.t,
      lines.find((l) => l.label === 'Tournament'),
    ),
    casual: side(
      pick.c,
      lines.find((l) => l.label === 'Casual'),
    ),
  };
}

export function pressureStory(p: Pressure): string {
  const { tournament: t, casual: c } = p;
  const name = p.putter.name;
  const { verdict, better } = compareRates(t.short, c.short);
  if (t.short.tried < MIN_PUTTS || c.short.tried < MIN_PUTTS)
    return `Not enough 3 to 10 ft putts with the ${name} on both sides to compare yet.`;
  const nums = `${pct(t.short)}% from 3 to 10 ft against ${pct(c.short)}% casual`;
  if (verdict === 'none') return `No clear difference with the ${name} yet, ${nums}.`;
  if (verdict === 'lean')
    return `With the ${name}, tournaments lean ${better ? 'better' : 'worse'}, ${nums}. ${t.rounds} tournament rounds isn't enough to call it yet.`;
  return better
    ? `With the ${name}, you putt better in tournaments, ${nums}.`
    : `With the ${name}, tournaments cost you, ${nums}.`;
}

// When in the round

export function timingStory(lines: GroupLine[]): string | null {
  const first = lines.find((l) => l.label === 'First 3 holes');
  const last = lines.find((l) => l.label === 'Last 3 holes');
  if (!first || !last || first.short.tried < MIN_PUTTS || last.short.tried < MIN_PUTTS) return null;
  const { verdict, better } = compareRates(last.short, first.short);
  if (verdict === 'none') return 'No clear change across a round.';
  const [l, f] = [pct(last.short), pct(first.short)];
  if (verdict === 'lean')
    return `No clear change across a round. Short putts lean ${better ? 'better' : 'worse'} on the last 3 holes, ${l}% against ${f}% on the first 3, but that's not enough putts to call yet.`;
  return `Short putts get ${better ? 'better' : 'worse'} late in a round, ${l}% on the last 3 holes against ${f}% on the first 3.`;
}

// Birdie vs par

const BIRDIE_BANDS = [
  { label: '3 to 5 ft', lo: 3, hi: 5 },
  { label: '6 to 8 ft', lo: 6, hi: 8 },
  { label: '9 to 15 ft', lo: 9, hi: 15 },
  { label: '16 to 30 ft', lo: 16, hi: 30 },
];
/** Par putts a putter needs at a length before they can stand in for that putter's usual there. */
const MIN_PAR_CELL = 5;
/** Birdie putts needed before the page says anything. */
export const MIN_BIRDIE = 30;

export interface BirdieVsPar {
  bands: { label: string; birdie: Tally; par: Tally }[];
  /** Birdie putts that had a fair par comparison, and what par putts would have holed. */
  holed: number;
  tried: number;
  expected: number;
  verdict: Verdict;
  /** Holed more than par putts from the same lengths would. */
  better: boolean;
}

/**
 * First putts only. A par putt that comes after a missed birdie putt has already seen the line, so
 * it would flatter par. Each birdie putt is judged against par putts by the same putter from the
 * same band, so neither the putter switch nor the mix of lengths can make a gap.
 */
export function birdieVsPar(rounds: Round[]): BirdieVsPar {
  const cells = new Map<string, { birdie: Tally; par: Tally }>();
  const birdies: { key: string; made: boolean }[] = [];
  for (const r of real(rounds))
    for (const h of r.holes) {
      if (h.par === undefined || !h.strokes || !h.putts.length) continue;
      const first = h.putts[0];
      const stroke = h.strokes - h.putts.length + 1;
      const kind = stroke === h.par - 1 ? 'birdie' : stroke === h.par ? 'par' : null;
      const band = BIRDIE_BANDS.findIndex((b) => first.d >= b.lo && first.d <= b.hi);
      if (!kind || band < 0) continue;
      const key = `${r.putterId}|${band}`;
      const cell = cells.get(key) ?? { birdie: { made: 0, tried: 0 }, par: { made: 0, tried: 0 } };
      cells.set(key, cell);
      cell[kind].tried++;
      if (first.made) cell[kind].made++;
      if (kind === 'birdie') birdies.push({ key, made: first.made });
    }

  let holed = 0;
  let tried = 0;
  let expected = 0;
  let variance = 0;
  for (const b of birdies) {
    const par = cells.get(b.key)!.par;
    if (par.tried < MIN_PAR_CELL) continue;
    const q = par.made / par.tried;
    tried++;
    if (b.made) holed++;
    expected += q;
    variance += q * (1 - q);
  }
  const z = variance > 0 ? (holed - expected) / Math.sqrt(variance) : 0;
  const bands = BIRDIE_BANDS.map((band, i) => {
    const out = { label: band.label, birdie: { made: 0, tried: 0 }, par: { made: 0, tried: 0 } };
    for (const [key, cell] of cells)
      if (key.endsWith(`|${i}`)) {
        out.birdie.made += cell.birdie.made;
        out.birdie.tried += cell.birdie.tried;
        out.par.made += cell.par.made;
        out.par.tried += cell.par.tried;
      }
    return out;
  }).filter((b) => b.birdie.tried + b.par.tried > 0);
  return { bands, holed, tried, expected, verdict: tried >= MIN_BIRDIE ? verdictOf(z) : 'none', better: z > 0 };
}

export function birdieStory(b: BirdieVsPar): string {
  if (b.tried < MIN_BIRDIE)
    return `Shows at ${MIN_BIRDIE} birdie putts with a fair par comparison. You have ${b.tried}.`;
  const nums = `You holed ${b.holed} of ${b.tried} birdie putts. Par putts from the same lengths, with the same putter, would have holed ${Math.round(b.expected)}.`;
  if (b.verdict === 'none') return `No clear gap yet. ${nums}`;
  if (b.verdict === 'lean')
    return `Birdie putts lean ${b.better ? 'better' : 'worse'}. ${nums} Not enough to call it yet.`;
  return `You putt ${b.better ? 'better' : 'worse'} for birdie. ${nums}`;
}

/** The home row's one-line read of the same thing. */
export function birdieSub(b: BirdieVsPar): string {
  if (b.tried < MIN_BIRDIE) return `Needs ${MIN_BIRDIE} birdie putts`;
  if (b.verdict === 'none') return 'No clear gap yet';
  if (b.verdict === 'lean') return `Leans ${b.better ? 'better' : 'worse'} for birdie`;
  return `${b.better ? 'Better' : 'Worse'} for birdie`;
}

// One-line findings for the home rows

/** A row's finding and a key for it, so a change in what it says can be told from a change in its numbers. */
export interface Finding {
  text: string;
  key: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function greensSub(lines: SpeedLine[]): Finding | null {
  const x = speedExtremes(lines);
  if (!x) return null;
  if (x.verdict === 'none') return { text: 'No clear difference yet', key: 'none' };
  if (x.verdict === 'lean') return { text: `Leans worse on ${x.worst.speed} greens`, key: `lean:${x.worst.speed}` };
  return {
    text: `${cap(x.worst.speed)} greens ${pct(x.worst.short)}%, ${x.best.speed} ${pct(x.best.short)}%`,
    key: `clear:${x.worst.speed}`,
  };
}

export function pressureSub(p: Pressure): Finding | null {
  const { tournament: t, casual: c } = p;
  if (t.short.tried < MIN_PUTTS || c.short.tried < MIN_PUTTS) return null;
  const { verdict, better } = compareRates(t.short, c.short);
  const word = better ? 'better' : 'worse';
  if (verdict === 'none') return { text: 'No clear difference yet', key: 'none' };
  if (verdict === 'lean') return { text: `Leans ${word}, not called yet`, key: `lean:${better}` };
  return { text: `${cap(word)} in tournaments`, key: `clear:${better}` };
}

export function timingSub(lines: GroupLine[]): Finding | null {
  const first = lines.find((l) => l.label === 'First 3 holes');
  const last = lines.find((l) => l.label === 'Last 3 holes');
  if (!first || !last || first.short.tried < MIN_PUTTS || last.short.tried < MIN_PUTTS) return null;
  const { verdict, better } = compareRates(last.short, first.short);
  const word = better ? 'better' : 'worse';
  if (verdict === 'none') return { text: 'No clear change', key: 'none' };
  if (verdict === 'lean') return { text: `Leans ${word} late, not called yet`, key: `lean:${better}` };
  return { text: `${cap(word)} late in a round`, key: `clear:${better}` };
}

export function putterSub([a, b]: [PutterLine, PutterLine]): Finding | null {
  const [sa, sb] = [a.bands[0], b.bands[0]];
  if (sa.tried < MIN_PUTTS || sb.tried < MIN_PUTTS) return null;
  const { verdict, better } = compareRates(sb, sa);
  const name = b.putter.name.split(' ')[0];
  if (verdict === 'none') return { text: 'No clear difference yet', key: 'none' };
  if (verdict === 'lean') return { text: `${name} leans ${better ? 'better' : 'worse'}`, key: `lean:${better}` };
  return { text: `${name}: 3 to 5 ft went ${pct(sa)}% to ${pct(sb)}%`, key: `clear:${better}` };
}
