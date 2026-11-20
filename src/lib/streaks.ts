import { conversion } from './situations';
import { roundStats } from './stats';
import { holeVsPar, type Round } from './types';

/**
 * Rounds in a row that cleared a bar. A round with nothing to judge the bar on (no scores, no
 * short putts) is skipped, so it neither keeps a run going nor ends one.
 */

interface StreakDef {
  key: string;
  label: string;
  /** How it reads next to a count on a round: "7x no three-putt". */
  short: string;
  test: (r: Round, baseline: [number, number][]) => boolean | null;
}

const putted = (r: Round) => r.holes.filter((h) => h.putts.length > 0);
const scored = (r: Round) => r.holes.filter((h) => holeVsPar(h) !== undefined);

const DEFS: StreakDef[] = [
  {
    key: 'nothree',
    label: 'No three-putts',
    short: 'no three-putt',
    test: (r) => !putted(r).some((h) => h.putts.length >= 3),
  },
  {
    key: 'gained',
    label: 'Gained strokes putting',
    short: 'gained putting',
    test: (r, b) => roundStats(r, b).sg > 0,
  },
  {
    key: 'putts30',
    label: '30 putts or fewer',
    short: '30 putts or fewer',
    // Scaled so a nine counts at 15.
    test: (r) => {
      const hs = putted(r);
      return hs.reduce((a, h) => a + h.putts.length, 0) <= (30 * hs.length) / 18;
    },
  },
  {
    key: 'inside3',
    label: 'Nothing missed from 3 ft and in',
    short: 'nothing missed inside 3 ft',
    test: (r) => {
      const short = r.holes.flatMap((h) => h.putts.filter((p) => p.d <= 3));
      return short.length ? short.every((p) => p.made) : null;
    },
  },
  {
    key: 'greens',
    label: 'Half the greens or more',
    short: 'half the greens',
    test: (r, b) => {
      const s = roundStats(r, b);
      return s.scoredHoles >= 9 ? s.gir * 2 >= s.scoredHoles : null;
    },
  },
  {
    key: 'saves',
    label: 'Saved par on half the greens missed',
    short: 'half the misses saved',
    test: (r) => {
      const c = conversion([r]);
      return c.missed >= 3 ? c.saves * 2 >= c.missed : null;
    },
  },
  {
    key: 'nodouble',
    label: 'No double bogeys',
    short: 'no doubles',
    test: (r) => {
      const hs = scored(r);
      return hs.length >= 9 ? hs.every((h) => holeVsPar(h)! < 2) : null;
    },
  },
  {
    key: 'par',
    label: 'Par or better',
    short: 'par or better',
    test: (r) => {
      const hs = scored(r);
      return hs.length >= 9 && hs.length === putted(r).length ? hs.reduce((a, h) => a + holeVsPar(h)!, 0) <= 0 : null;
    },
  },
];

export interface Streak {
  key: string;
  label: string;
  short: string;
  current: number;
  /** The round the current run started on, and the latest one in it. */
  since: Round | null;
  latest: Round | null;
  best: number;
  bestFrom: Round | null;
  bestTo: Round | null;
  /** The round that ended the last run, when nothing is running now. */
  endedOn: Round | null;
  /** Each round's place in its run, for rounds that cleared the bar. */
  counts: Map<string, number>;
}

const MIN_HOLES = 9;

const inOrder = (all: Round[]) =>
  all
    .filter((r) => r.finished && !r.practice && putted(r).length >= MIN_HOLES)
    .sort((a, b) => a.date.localeCompare(b.date));

export function streaks(all: Round[], baseline: [number, number][]): Streak[] {
  const rs = inOrder(all);
  return DEFS.map((d) => {
    const counts = new Map<string, number>();
    let run: Round[] = [];
    let best: Round[] = [];
    let endedOn: Round | null = null;
    for (const r of rs) {
      const ok = d.test(r, baseline);
      if (ok === null) continue;
      if (ok) {
        run = [...run, r];
        counts.set(r.id, run.length);
        if (run.length > best.length) best = run;
      } else {
        if (run.length) endedOn = r;
        run = [];
      }
    }
    return {
      key: d.key,
      label: d.label,
      short: d.short,
      current: run.length,
      since: run[0] ?? null,
      latest: run[run.length - 1] ?? null,
      best: best.length,
      bestFrom: best[0] ?? null,
      bestTo: best[best.length - 1] ?? null,
      endedOn: run.length ? null : endedOn,
      counts,
    };
  });
}

/** A run is worth naming on a round from its third round on. */
export const ROUND_STREAK_MIN = 3;

/** The runs this round was part of, longest first: "7x no three-putt". */
export function roundStreaks(round: Round, all: Round[], baseline: [number, number][]) {
  return streaks(all, baseline)
    .map((s) => ({ key: s.key, short: s.short, n: s.counts.get(round.id) ?? 0, best: s.best }))
    .filter((s) => s.n >= ROUND_STREAK_MIN)
    .sort((a, b) => b.n - a.n);
}
