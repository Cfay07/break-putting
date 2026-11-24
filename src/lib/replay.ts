import { condsOf, ZONE_RANGE, type Cond } from './pinpoint';
import { breakDirsOf, slopeOf, type BreakDir, type DrillDef, type PracticeSet, type Round, type Zone } from './types';

/**
 * Replay your misses: putts you missed on the course, or in a practice round, rebuilt so you can
 * hit that same putt again. Each replay is saved as an ordinary practice set pointing back at the
 * putt it replays, so it syncs and shows in your practice log like any other set, and a putt
 * keeps its own replay record however many times you come back to it.
 */

export const REPLAY_ID = 'replay';
/** Tries before a replay stops counting: past this it is a different drill. */
export const MAX_TRIES = 10;
/** The lengths worth replaying: past a tap-in, short of a lag. */
export const REPLAY_FROM = 3;
export const REPLAY_TO = 12;
export const RECOMMENDED = 5;

export function replayDef(): DrillDef {
  return {
    id: REPLAY_ID,
    name: 'Replay',
    scoring: 'count',
    stations: [],
    how: 'Putts you missed, hit again from the same spot.',
    surfaces: ['indoor', 'green'],
    putting: true,
    source: 'app',
  };
}

/** Which putt a replay set replays. */
export interface ReplayOf {
  roundId: string;
  hole: number;
  putt: number;
}

export interface Miss {
  key: string;
  of: ReplayOf;
  practice: boolean;
  date: string;
  course: string;
  putterId: string;
  d: number;
  /** "5 ft, downhill, left to right" */
  label: string;
  /** What happened, from its tags: "Missed low, pushed. You read 2, it broke 3." */
  what: string;
  /** How to set it up and the one thing to do differently. */
  setup: string;
  conds: Cond[];
}

export const keyOf = (o: ReplayOf) => `${o.roundId}:${o.hole}:${o.putt}`;

const breakWords = (dirs: BreakDir[]): string | null => {
  const lr = dirs.includes('L→R');
  const rl = dirs.includes('R→L');
  if (lr && rl) return 'breaking both ways';
  if (lr) return 'left to right';
  if (rl) return 'right to left';
  if (dirs.includes('straight')) return 'straight';
  return null;
};

function describe(p: Round['holes'][number]['putts'][number]): { label: string; what: string; setup: string } {
  const dirs = breakDirsOf(p);
  const brk = breakWords(dirs);
  const slope = slopeOf(dirs);
  const label = [`${p.d} ft`, slope, brk].filter(Boolean).join(', ');

  const how: string[] = [];
  if (p.lip) how.push('Lipped out');
  else if (p.missSide === 'low') how.push('Missed low');
  else if (p.missSide === 'high') how.push('Missed high');
  if (p.speed === 'short') how.push(how.length ? 'short' : 'Short');
  if (p.speed === 'long') how.push(how.length ? 'long' : 'Long');
  if (p.push) how.push(how.length ? 'pushed' : 'Pushed');
  if (p.pull) how.push(how.length ? 'pulled' : 'Pulled');
  const read = p.wrongWay
    ? 'You read it the wrong way.'
    : p.readAs && p.brokeAs
      ? `You read ${p.readAs}, it broke ${p.brokeAs}.`
      : p.readAs
        ? 'You read it right.'
        : '';
  const what = [how.length ? `${how.join(', ')}.` : '', read].filter(Boolean).join(' ') || 'Missed.';

  const place = `Find ${p.d} ft${brk && brk !== 'straight' ? ` breaking ${brk}` : brk === 'straight' ? ', straight' : ''}${slope ? `, ${slope}` : ''}.`;
  const fix = p.wrongWay
    ? 'Read it from behind the hole too: it goes the other way.'
    : p.readAs && p.brokeAs && p.brokeAs > p.readAs
      ? 'Play more break than it looks.'
      : p.readAs && p.brokeAs && p.brokeAs < p.readAs
        ? 'Play less break than it looks.'
        : p.push || p.pull
          ? 'Same read. Start it on your line.'
          : p.speed === 'short'
            ? 'Same line, get it to the hole.'
            : p.speed === 'long'
              ? 'Same line, softer.'
              : 'Same putt, until it drops.';
  return { label, what, setup: `${place} ${fix}` };
}

/** Every missed putt from 3 to 12 ft in a round, in the order played. */
export function missesOf(round: Round, practice = false): Miss[] {
  const out: Miss[] = [];
  for (const h of round.holes)
    h.putts.forEach((p, i) => {
      if (p.made || p.d < REPLAY_FROM || p.d > REPLAY_TO) return;
      const of = { roundId: round.id, hole: h.hole, putt: i };
      out.push({
        key: keyOf(of),
        of,
        practice,
        date: round.date,
        course: round.course ?? (practice ? 'Practice round' : 'Round'),
        putterId: round.putterId,
        d: p.d,
        conds: condsOf(p),
        ...describe(p),
      });
    });
  return out;
}

export interface Replayed {
  made: number;
  attempts: number;
  times: number;
  last: string;
  /** The newest replay: how many tries, and whether it dropped. */
  lastTries: number;
  lastHoled: boolean;
}

/** What each putt has done in its replays so far. */
export function replayHistory(sets: PracticeSet[]): Map<string, Replayed> {
  const out = new Map<string, Replayed>();
  for (const s of sets) {
    if (s.drill !== REPLAY_ID || !s.replay) continue;
    const k = keyOf(s.replay);
    const h = out.get(k) ?? { made: 0, attempts: 0, times: 0, last: '', lastTries: 0, lastHoled: false };
    h.made += s.made;
    h.attempts += s.attempts;
    h.times++;
    if (s.date >= h.last) {
      h.last = s.date;
      h.lastTries = s.attempts;
      h.lastHoled = s.made > 0;
    }
    out.set(k, h);
  }
  return out;
}

/**
 * The putts to replay this week, from every round and practice round together: the misses that
 * match your target first, newest first, then any other short misses to fill the list. A putt you
 * already holed every ball on in a replay waits behind the rest.
 */
export function recommended(
  rounds: Round[],
  practiceRounds: Round[],
  targetKey: string | null,
  history: Map<string, Replayed>,
  n = RECOMMENDED,
): Miss[] {
  const all = [
    ...rounds.filter((r) => r.finished && !r.practice).flatMap((r) => missesOf(r)),
    ...practiceRounds.flatMap((r) => missesOf(r, true)),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.of.hole - b.of.hole);
  const [type, zone, cond] = (targetKey ?? '').split(':');
  const range = (type === 'slice' || type === 'zone') && zone in ZONE_RANGE ? ZONE_RANGE[zone as Zone] : null;
  const fits = (m: Miss) =>
    !!range && m.d >= range[0] && m.d <= range[1] && (type !== 'slice' || m.conds.includes(cond as Cond));
  // Holed first time in its newest replay: it can wait behind the putts still giving you trouble.
  const cleared = (m: Miss) => {
    const h = history.get(m.key);
    return !!h && h.lastHoled && h.lastTries === 1;
  };
  const rank = (m: Miss) => (fits(m) ? 0 : 2) + (cleared(m) ? 1 : 0);
  return [...all].sort((a, b) => rank(a) - rank(b)).slice(0, n);
}

/** "Holed on try 3", "Holed first try", or "5 tries, didn't drop". */
export function triesText(tries: number, holed: boolean): string {
  if (!holed) return `${tries} ${tries === 1 ? 'try' : 'tries'}, didn't drop`;
  return tries === 1 ? 'Holed first try' : `Holed on try ${tries}`;
}
