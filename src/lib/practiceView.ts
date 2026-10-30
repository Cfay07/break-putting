import { scoreOf, type DrillHistory } from './practice';
import type { BallMode, DrillDef, PracticeSet, StationResult } from './types';

export const MODE_WORDS: Record<BallMode, { yes: string; no: string; noun: string }> = {
  make: { yes: 'Made', no: 'Missed', noun: 'holed' },
  twoputt: { yes: 'Two-putt', no: 'Three', noun: 'two-putts' },
  zone: { yes: 'Inside', no: 'Outside', noun: 'inside' },
};

export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** What one set scored, in the words the drill is scored in. */
export function setScore(drill: Pick<DrillDef, 'scoring' | 'stations' | 'target'> | undefined, s: PracticeSet): string {
  if (s.game) {
    const who = s.game.opponent;
    const pts = s.game.mine !== undefined && s.game.theirs !== undefined ? ` ${s.game.mine}-${s.game.theirs}` : '';
    return s.game.result === 'win' ? `Beat ${who}${pts}` : s.game.result === 'loss' ? `Lost to ${who}${pts}` : `Tied ${who}${pts}`;
  }
  if (drill?.scoring === 'done') return s.finished ? 'Done' : 'Not finished';
  if (s.run !== undefined) {
    if (drill?.target && s.finished && s.seconds !== undefined) return `${drill.target} in a row in ${clock(s.seconds)}`;
    return `Best run ${s.run}`;
  }
  if (s.reached !== undefined) {
    if (s.finished) return s.seconds !== undefined ? `Finished in ${clock(s.seconds)}` : 'Finished';
    const last = drill?.stations[s.reached - 1];
    return last ? `Got to ${last.d} ft` : 'Stopped at the first station';
  }
  return `${s.made} of ${s.attempts}`;
}

/** The short form for a column label or a row's right edge. */
export function setScoreShort(drill: DrillDef | undefined, s: PracticeSet): string {
  if (s.run !== undefined) return drill?.target && s.finished && s.seconds !== undefined ? clock(s.seconds) : `${s.run}`;
  if (s.reached !== undefined) return s.finished ? 'Done' : `${drill?.stations[s.reached - 1]?.d ?? 0} ft`;
  if (drill?.scoring === 'done') return s.finished ? 'Done' : 'No';
  return `${s.made}/${s.attempts}`;
}

/** One line against this drill's own past. Never a grade, only the comparison. */
export function verdict(drill: DrillDef | undefined, set: PracticeSet, before: DrillHistory | null): string {
  if (!before) return 'First set of this one.';
  const mine = scoreOf(set);
  const top = scoreOf(before.best);
  const last = setScore(drill, before.last);
  if (mine > top) return `Best yet. Last time: ${last}.`;
  if (mine === top) return `Matches your best. Last time: ${last}.`;
  return `Last time: ${last}. Best: ${setScore(drill, before.best)}.`;
}

/** Ball outcomes folded into per-distance tallies, the shape practice-against-play reads. */
export function tallyStations(balls: { d: number; mode: BallMode; made: boolean }[]): StationResult[] {
  const m = new Map<string, StationResult>();
  for (const b of balls) {
    if (b.d <= 0) continue;
    const key = `${b.mode}|${b.d}`;
    const cur = m.get(key) ?? { d: b.d, mode: b.mode, made: 0, attempts: 0 };
    cur.attempts++;
    if (b.made) cur.made++;
    m.set(key, cur);
  }
  return [...m.values()];
}

export const ON_MISS_TEXT: Record<NonNullable<DrillDef['onMiss']>, string> = {
  end: 'A failed station ends the attempt.',
  restart: 'A miss anywhere starts you over.',
  checkpoint: 'A miss sends you back to the last checkpoint.',
  back: 'A fail sends you back one station.',
  stay: 'A fail means go again from the same station.',
};
