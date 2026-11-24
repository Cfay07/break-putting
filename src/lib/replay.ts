import { condsOf, ZONE_RANGE, type Cond } from './pinpoint';
import { LAG_FROM, LEAVE_STANDARD } from './stats';
import { breakDirsOf, slopeOf, type BreakDir, type DrillDef, type PracticeSet, type Round, type Zone } from './types';

/**
 * Replay your misses: putts you missed on the course, or in a practice round, rebuilt so you can
 * hit that same putt again. Each replay is saved as an ordinary practice set pointing back at the
 * putt it replays, so it syncs and shows in your practice log like any other set, and a putt
 * keeps its own replay record however many times you come back to it.
 */

export const REPLAY_ID = 'replay';
/** Where a replay that missed went, in the tagging screen's words. */
export type ReplayMiss = 'low' | 'high' | 'short' | 'long';
export const REPLAY_MISSES: ReplayMiss[] = ['low', 'high', 'short', 'long'];
/** Course putts of a kind since its first replay, before Redemption says anything. */
export const REDEEM_AFTER = 10;
/** The lengths worth replaying: past a tap-in, short of a lag. */
export const REPLAY_FROM = 3;
export const REPLAY_TO = 12;
export const RECOMMENDED = 5;
/** Of the recommended putts, how many come from your target before the mix fills the rest. */
const TARGET_SHARE = 3;

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
  /** The same story in a few words each, for the card: how it missed, the read, the one fix. */
  bits: { missed: string; read?: string; fix: string };
  conds: Cond[];
  /** How it missed on the course, so a replay can say whether the same miss came back. */
  onCourse: { side?: 'low' | 'high' | 'online'; speed?: 'short' | 'good' | 'long'; lip?: boolean };
  /** The kind of putt it is, for Redemption: its length band and which way it breaks. */
  kind: { key: string; label: string };
  /** "for par", from the hole's par and score. Missing when the hole has no score. */
  forWhat?: string;
  /** In Recommended: from your target, or mixed in from another kind you keep missing. */
  why?: 'target' | 'mix';
  /** A lag that finished outside 10% of its length: judged on getting inside that, not holing it. */
  lag?: {
    leave: number;
    within: number;
    /** The comebacker it left: holed or not, how many putts the hole took, and its break for the make model. */
    next: { made: boolean; putts: number; dirs: BreakDir[] };
  };
}

export const keyOf = (o: ReplayOf) => `${o.roundId}:${o.hole}:${o.putt}`;

/** The read picker's own words for its steps, so the card talks the way you tagged it. */
const READ_WORD: Record<number, string> = { 0: 'none', 1: 'slight', 2: 'some', 3: 'lots', 4: 'severe' };

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

const breakWords = (dirs: BreakDir[]): string | null => {
  const lr = dirs.includes('L→R');
  const rl = dirs.includes('R→L');
  if (lr && rl) return 'breaking both ways';
  if (lr) return 'left to right';
  if (rl) return 'right to left';
  if (dirs.includes('straight')) return 'straight';
  return null;
};

function describe(p: Round['holes'][number]['putts'][number]): {
  label: string;
  what: string;
  setup: string;
  bits: Miss['bits'];
} {
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
      ? `You read it ${READ_WORD[p.readAs] ?? p.readAs}, it broke ${READ_WORD[p.brokeAs] ?? p.brokeAs}.`
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
  const readBit = p.wrongWay
    ? 'Wrong way'
    : p.readAs && p.brokeAs
      ? `${cap(READ_WORD[p.readAs] ?? '')} → ${READ_WORD[p.brokeAs] ?? ''}`
      : p.readAs
        ? 'Right'
        : undefined;
  const fixBit = p.wrongWay
    ? 'Read from behind'
    : p.readAs && p.brokeAs && p.brokeAs > p.readAs
      ? 'More break'
      : p.readAs && p.brokeAs && p.brokeAs < p.readAs
        ? 'Less break'
        : p.push || p.pull
          ? 'Start line'
          : p.speed === 'short'
            ? 'To the hole'
            : p.speed === 'long'
              ? 'Softer'
              : 'Same putt';
  return {
    label,
    what,
    setup: `${place} ${fix}`,
    bits: { missed: how.length ? cap(how.join(', ')) : 'Missed', read: readBit, fix: fixBit },
  };
}

/** Inside 10% of the putt, rounded up to a whole foot so the goal is something you can pace off. */
export const withinOf = (d: number) => Math.max(1, Math.ceil(d * LEAVE_STANDARD));

function describeLag(
  p: Round['holes'][number]['putts'][number],
  leave: number,
): { label: string; what: string; setup: string; bits: Miss['bits'] } {
  const dirs = breakDirsOf(p);
  const brk = breakWords(dirs);
  const slope = slopeOf(dirs);
  const label = [`${p.d} ft lag`, slope, brk && brk !== 'straight' ? brk : null].filter(Boolean).join(', ');
  const pace = p.speed === 'short' ? ', short' : p.speed === 'long' ? ', past' : '';
  const what = `Left it ${leave} ft${pace}.`;
  const fix =
    p.speed === 'short' ? 'Get it to the hole.' : p.speed === 'long' ? 'Die it at the hole.' : 'Pace it to the hole.';
  return {
    label,
    what,
    setup: `Find ${p.d} ft${slope ? `, ${slope}` : ''}. ${fix} Inside ${withinOf(p.d)} ft counts.`,
    bits: {
      missed: `Left ${leave} ft${p.speed === 'short' ? ', short' : p.speed === 'long' ? ', past' : ''}`,
      fix: p.speed === 'short' ? 'To the hole' : p.speed === 'long' ? 'Die it' : 'Pace',
    },
  };
}

/** "Downhill lags": lags group by slope only, since a lag goes wrong on pace whichever way it breaks. */
export function lagKindOf(conds: Cond[]): { key: string; label: string } {
  const slope = conds.includes('uphill') ? 'uphill' : conds.includes('downhill') ? 'downhill' : null;
  return {
    key: `lag:${slope ?? 'any'}`,
    label: slope
      ? `${slope === 'uphill' ? 'Uphill' : 'Downhill'} lags, ${LAG_FROM} ft and out`
      : `Lags, ${LAG_FROM} ft and out`,
  };
}

const isLagPutt = (i: number, d: number) => i === 0 && d >= LAG_FROM;
const goodLag = (made: boolean, d: number, leave: number | undefined) =>
  made || (leave !== undefined && leave <= d * LEAVE_STANDARD);

const KIND_ZONES: Zone[] = ['short', 'mid', 'long'];
const SIDE_LABEL: Partial<Record<Cond, string>> = {
  lr: 'Left-to-right',
  rl: 'Right-to-left',
  straight: 'Straight',
  double: 'Double-breaking',
};

/** "Left-to-right putts, 3 to 5 ft": the length band and the side it breaks, nothing finer. */
export function kindOf(d: number, conds: Cond[]): { key: string; label: string } {
  const zone = KIND_ZONES.find((z) => d >= ZONE_RANGE[z][0] && d <= ZONE_RANGE[z][1]) ?? 'long';
  const [lo, hi] = ZONE_RANGE[zone];
  const side = (['lr', 'rl', 'double', 'straight'] as Cond[]).find((c) => conds.includes(c)) ?? null;
  const len = `${lo} to ${hi} ft`;
  return {
    key: `${zone}:${side ?? 'any'}`,
    label: side ? `${SIDE_LABEL[side]} putts, ${len}` : `Putts from ${len}`,
  };
}

/** Every missed putt from 3 to 12 ft in a round, in the order played. */
export function missesOf(round: Round, practice = false): Miss[] {
  const out: Miss[] = [];
  for (const h of round.holes)
    h.putts.forEach((p, i) => {
      const lag = isLagPutt(i, p.d);
      const leave = h.putts[i + 1]?.d;
      if (lag ? leave === undefined || goodLag(p.made, p.d, leave) : p.made || p.d < REPLAY_FROM || p.d > REPLAY_TO)
        return;
      const of = { roundId: round.id, hole: h.hole, putt: i };
      const stroke = h.par !== undefined && h.strokes ? h.strokes - h.putts.length + i + 1 : null;
      const forWhat =
        stroke === null || h.par === undefined
          ? undefined
          : ({ [-2]: 'for eagle', [-1]: 'for birdie', 0: 'for par', 1: 'for bogey' } as Record<number, string>)[
              stroke - h.par
            ];
      out.push({
        forWhat,
        key: keyOf(of),
        of,
        practice,
        date: round.date,
        course: round.course ?? (practice ? 'Practice round' : 'Round'),
        putterId: round.putterId,
        d: p.d,
        conds: condsOf(p),
        onCourse: { side: p.missSide, speed: p.speed, lip: p.lip },
        kind: lag ? lagKindOf(condsOf(p)) : kindOf(p.d, condsOf(p)),
        ...(lag
          ? {
              lag: {
                leave: leave!,
                within: withinOf(p.d),
                next: { made: !!h.putts[i + 1]?.made, putts: h.putts.length, dirs: breakDirsOf(h.putts[i + 1]) },
              },
            }
          : {}),
        ...(lag ? describeLag(p, leave!) : describe(p)),
      });
    });
  return out;
}

export interface Replayed {
  /** First tries across every replay of this putt. */
  holed: number;
  tries: number;
  last: string;
  lastHoled: boolean;
  lastMiss?: ReplayMiss;
}

/** What each putt has done in its replays so far. */
export function replayHistory(sets: PracticeSet[]): Map<string, Replayed> {
  const out = new Map<string, Replayed>();
  for (const s of sets) {
    if (s.drill !== REPLAY_ID || !s.replay) continue;
    const k = keyOf(s.replay);
    const h = out.get(k) ?? { holed: 0, tries: 0, last: '', lastHoled: false };
    h.tries++;
    if (s.made > 0) h.holed++;
    if (s.date >= h.last) {
      h.last = s.date;
      h.lastHoled = s.made > 0;
      h.lastMiss = s.replayMiss;
    }
    out.set(k, h);
  }
  return out;
}

const MISS_WORD: Record<ReplayMiss, string> = { low: 'Low', high: 'High', short: 'Short', long: 'Long' };

/** The course miss in a few words: "missed low", "lipped out", "came up short". */
function courseMissText(c: Miss['onCourse']): string {
  if (c.lip) return 'lipped out';
  const side = c.side === 'low' ? 'missed low' : c.side === 'high' ? 'missed high' : null;
  const pace = c.speed === 'short' ? 'came up short' : c.speed === 'long' ? 'ran long' : null;
  return [side, pace].filter(Boolean).join(' and ') || 'missed';
}

/** Did the replay miss the same way the course putt did? Unknown when the course miss had no tag. */
export function sameMiss(c: Miss['onCourse'], m: ReplayMiss): boolean | null {
  const known = c.side === 'low' || c.side === 'high' || c.speed === 'short' || c.speed === 'long';
  if (!known) return null;
  return m === c.side || m === c.speed;
}

/** The line under a replay once it is logged. */
export function replayResult(miss: Miss, holed: boolean, m?: ReplayMiss): string {
  if (miss.lag) {
    const was = `On the course you left it ${miss.lag.leave} ft.`;
    if (holed) return `Inside ${miss.lag.within} ft. ${was}`;
    if (!m) return 'Outside. Short or long?';
    const same = sameMiss(miss.onCourse, m);
    return same === true ? `${MISS_WORD[m]} again. Same miss as the course.` : `${MISS_WORD[m]} this time. ${was}`;
  }
  const course = courseMissText(miss.onCourse);
  if (holed) return `Holed first try. On the course this one ${course}.`;
  if (!m) return 'Missed. Where did it go?';
  const same = sameMiss(miss.onCourse, m);
  if (same === true) return `${MISS_WORD[m]} again. Same miss as the course.`;
  if (same === false) return `${MISS_WORD[m]} this time. On the course it ${course}.`;
  return `${MISS_WORD[m]}.`;
}

/** "Last replay: holed first try" or "Last replay: missed low". */
export function lastReplayText(h: Replayed, lag = false): string {
  const good = lag ? 'inside 10%' : 'holed first try';
  const base = h.lastHoled
    ? good
    : h.lastMiss
      ? `${lag ? 'finished' : 'missed'} ${h.lastMiss}`
      : lag
        ? 'outside'
        : 'missed';
  return `Last replay: ${base}${h.tries > 1 ? ` · ${h.holed} of ${h.tries} ${lag ? 'inside 10%' : 'holed first try'}` : ''}`;
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
  // Holed in its newest replay: it can wait behind the putts still giving you trouble.
  const cleared = (m: Miss) => !!history.get(m.key)?.lastHoled;
  const fresh = (xs: Miss[]) => [...xs].sort((a, b) => Number(cleared(a)) - Number(cleared(b)));
  const target = fresh(all.filter(fits)).map((m) => ({ ...m, why: 'target' as const }));
  // The rest, grouped by kind, the kinds you miss most first: one from each in turn, so the mix
  // covers several struggles instead of five of the same.
  const kinds = new Map<string, Miss[]>();
  for (const m of all.filter((x) => !fits(x))) kinds.set(m.kind.key, [...(kinds.get(m.kind.key) ?? []), m]);
  const queues = [...kinds.values()].sort((a, b) => b.length - a.length).map(fresh);
  const mix: Miss[] = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) mix.push({ ...q.shift()!, why: 'mix' });
  const fromTarget = target.slice(0, Math.min(TARGET_SHARE, n));
  const mixed = mix.filter((m) => !m.lag).slice(0, n - fromTarget.length);
  // Lags never outnumber short misses, so they would never make the mix: one spot is theirs.
  const lag = mix.find((m) => m.lag) ?? target.find((m) => m.lag);
  if (lag && !fromTarget.some((m) => m.lag) && mixed.length) mixed[mixed.length - 1] = { ...lag, why: lag.why };
  const more = target.slice(fromTarget.length, fromTarget.length + (n - fromTarget.length - mixed.length));
  const t = [...fromTarget, ...more];
  // Alternate target and mix, so the session switches putts the way a round does.
  const out: Miss[] = [];
  for (let i = 0; out.length < t.length + mixed.length; i++) {
    if (i < t.length) out.push(t[i]);
    if (i < mixed.length) out.push(mixed[i]);
  }
  return out;
}

/* ---------- Redemption: the same kind of putt, on the course, before and after replaying it ---------- */

export interface Redemption {
  key: string;
  label: string;
  since: string;
  before: { made: number; attempts: number };
  after: { made: number; attempts: number };
  /** Holing more since the first replay, past chance on a one-sided test. */
  verdict: 'early' | 'better' | 'notyet';
  /** Replays of this kind: first tries holed, and of the misses with a direction, how many repeated the course miss. */
  replays: { holed: number; tries: number; same: number; sided: number };
}

function beats(b: { made: number; attempts: number }, a: { made: number; attempts: number }): boolean {
  if (!b.attempts || !a.attempts) return false;
  const pooled = (b.made + a.made) / (b.attempts + a.attempts);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / b.attempts + 1 / a.attempts));
  return se > 0 && (a.made / a.attempts - b.made / b.attempts) / se >= 1.645;
}

/**
 * For every kind of putt you have replayed: your course putts of that kind before the first replay
 * and since, and how the replays themselves went. Course putts only, so practice never grades
 * itself, and it never says the replays did it.
 */
export function redemption(rounds: Round[], practiceRounds: Round[], sets: PracticeSet[]): Redemption[] {
  const byId = new Map([...rounds, ...practiceRounds].map((r) => [r.id, r]));
  const kinds = new Map<string, Redemption>();
  for (const s of [...sets].sort((a, b) => a.date.localeCompare(b.date))) {
    if (s.drill !== REPLAY_ID || !s.replay) continue;
    const r = byId.get(s.replay.roundId);
    const p = r?.holes.find((h) => h.hole === s.replay!.hole)?.putts[s.replay.putt];
    if (!r || !p) continue;
    const lag = isLagPutt(s.replay.putt, p.d);
    const kind = lag ? lagKindOf(condsOf(p)) : kindOf(p.d, condsOf(p));
    const k =
      kinds.get(kind.key) ??
      ({
        ...kind,
        since: s.date,
        before: { made: 0, attempts: 0 },
        after: { made: 0, attempts: 0 },
        verdict: 'early',
        replays: { holed: 0, tries: 0, same: 0, sided: 0 },
      } as Redemption);
    k.replays.tries++;
    if (s.made > 0) k.replays.holed++;
    else if (s.replayMiss) {
      const same = sameMiss({ side: p.missSide, speed: p.speed, lip: p.lip }, s.replayMiss);
      if (same !== null) {
        k.replays.sided++;
        if (same) k.replays.same++;
      }
    }
    kinds.set(kind.key, k);
  }
  for (const k of kinds.values()) {
    const lagKind = k.key.startsWith('lag:');
    for (const r of rounds.filter((x) => x.finished && !x.practice))
      for (const h of r.holes)
        h.putts.forEach((p, i) => {
          const side = r.date >= k.since ? k.after : k.before;
          if (lagKind) {
            const leave = h.putts[i + 1]?.d;
            if (!isLagPutt(i, p.d) || (!p.made && leave === undefined) || lagKindOf(condsOf(p)).key !== k.key) return;
            side.attempts++;
            if (goodLag(p.made, p.d, leave)) side.made++;
            return;
          }
          if (p.d < REPLAY_FROM || p.d > REPLAY_TO || kindOf(p.d, condsOf(p)).key !== k.key) return;
          side.attempts++;
          if (p.made) side.made++;
        });
    k.verdict = k.after.attempts < REDEEM_AFTER ? 'early' : beats(k.before, k.after) ? 'better' : 'notyet';
  }
  return [...kinds.values()].sort((a, b) => b.replays.tries - a.replays.tries);
}
