import { tournamentVsCasual } from './situations';
import { byStretch } from './situations';
import { MIN_STRIKE } from './stats';
import { MEASURES } from './statsHome';
import {
  birdieVsPar,
  greensFor,
  greensSub,
  MIN_BIRDIE,
  MIN_PUTTS,
  MIN_SIDE_ROUNDS,
  pressureFor,
  pressureSub,
  putterPair,
  putterSub,
  speedLines,
  timingSub,
  type Finding,
} from './topicFindings';
import type { Putter, Round } from './types';

/**
 * Which Stats pages have enough to say anything, and for the ones that don't, what to log to open
 * them. A new player sees every page from the first round, so nothing they could unlock is hidden.
 */

export interface Lock {
  /** What to do, in the words the tagging screens use. */
  how: string;
  /** How far there is to go, or null when a count would not mean anything. */
  need: string | null;
}

/** Each page in one line, for a locked page and for the post-round line when one opens. */
export const TOPIC_ABOUT: Record<string, string> = {
  distance: 'Your make rate from every distance, against tour.',
  lag: 'Your lags from 30 ft and more, how close they finish, with the 3-putts marked.',
  bleed: 'The strokes your putting mistakes put on the card, and whether they spiral.',
  reads: 'How often you read the break right, and which way you misread it.',
  misses: 'Where your misses finish, high or low, short or long.',
  strike: 'Where the ball comes off the face, and what an off-centre strike costs you.',
  greens: 'How you putt on slow, medium and fast greens, one putter at a time.',
  pressure: 'Tournament rounds against casual ones, one putter at a time so a switch cannot pass for nerves.',
  birdie: 'Birdie putts against par putts from the same lengths with the same putter.',
};

export const TOPIC_TITLES: Record<string, string> = {
  distance: 'By distance',
  lag: 'Lag',
  bleed: 'Bleed',
  reads: 'Reads',
  misses: 'Misses',
  strike: 'Strike',
  greens: 'Greens',
  pressure: 'Tournament vs casual',
  timing: 'When in the round',
  putter: 'By putter',
  birdie: 'Birdie vs par',
};

/** What a home row's number has to stand on before it shows. A rate off three putts is noise. */
export const ROW_MIN: Record<string, { measure: string; min: number; how: string; unit: string }> = {
  distance: { measure: 'short', min: 20, how: 'Putts from 3 to 10 ft', unit: 'putts' },
  lag: { measure: 'lag', min: 10, how: 'First putts from 30 ft or more', unit: 'lags' },
  reads: { measure: 'reads', min: 8, how: 'Tag the read on your putts', unit: 'putts' },
  misses: { measure: 'misses', min: 8, how: 'Tag where it finished on misses', unit: 'misses' },
  strike: { measure: 'strike', min: MIN_STRIKE, how: 'Tag the face on your putts', unit: 'putts' },
};

const real = (rounds: Round[]) => rounds.filter((r) => r.finished && !r.practice);

export function locksFor(rounds: Round[], baseline: [number, number][]): Record<string, Lock> {
  const rs = real(rounds);
  const out: Record<string, Lock> = {};
  for (const [topic, m] of Object.entries(ROW_MIN)) {
    const n = MEASURES[m.measure](rs, baseline)?.n ?? 0;
    const left = m.min - n;
    if (left > 0)
      out[topic] = { how: m.how, need: `${left} more ${left === 1 ? m.unit.replace(/(es|s)$/, '') : m.unit}` };
  }

  // Greens and pressure compare one putter with itself, so they open when one putter has enough
  // on both sides, the same bar their findings use. Two speeds with a putt each says nothing.
  const putterIds = [...new Set(rs.map((r) => r.putterId))];
  const speeds = new Set(rs.map((r) => r.greenSpeed).filter(Boolean)).size;
  const atSecondSpeed = Math.max(
    0,
    ...putterIds.map(
      (id) =>
        speedLines(rs, id)
          .map((l) => l.short.tried)
          .sort((a, b) => b - a)[1] ?? 0,
    ),
  );
  if (speeds < 2)
    out.greens = { how: 'Pick the green speed on rounds at two speeds', need: speeds ? '1 more speed' : '2 speeds' };
  else if (atSecondSpeed < MIN_PUTTS)
    out.greens = {
      how: 'Putts from 3 to 10 ft at two speeds with one putter',
      need: `${MIN_PUTTS - atSecondSpeed} more at a second speed`,
    };

  const tournaments = rs.filter((r) => r.competitive).length;
  const short = (have: number) => Math.max(0, MIN_SIDE_ROUNDS - have);
  const closest = putterIds
    .map((id) => {
      const mine = rs.filter((r) => r.putterId === id);
      const t = mine.filter((r) => r.competitive).length;
      return { t: short(t), c: short(mine.length - t) };
    })
    .sort((a, b) => a.t + a.c - (b.t + b.c))[0];
  if (!tournaments || tournaments === rs.length)
    out.pressure = {
      how: tournaments ? 'Play a casual round too' : 'Mark tournament rounds when you start one',
      need: tournaments ? '1 casual' : '1 tournament',
    };
  else if (closest && closest.t + closest.c > 0)
    out.pressure = {
      how: `${MIN_SIDE_ROUNDS} tournament and ${MIN_SIDE_ROUNDS} casual rounds with one putter`,
      need: [closest.t && `${closest.t} more tournament`, closest.c && `${closest.c} more casual`]
        .filter(Boolean)
        .join(', '),
    };

  const birdie = birdieVsPar(rs);
  if (birdie.tried < MIN_BIRDIE)
    out.birdie = { how: 'Birdie putts with a fair par match', need: `${MIN_BIRDIE - birdie.tried} more` };
  return out;
}

/** The finding each "When it changes" row carries under its title, where there is one. */
export function findingsFor(
  rounds: Round[],
  putters: Putter[],
  baseline: [number, number][],
): Record<string, Finding | null> {
  const g = greensFor(rounds, putters);
  const p = pressureFor(rounds, putters, (rs) => tournamentVsCasual(rs, baseline));
  const pair = putterPair(rounds, putters);
  const b = birdieVsPar(rounds);
  return {
    greens: g ? greensSub(g.lines) : null,
    pressure: p ? pressureSub(p) : null,
    timing: timingSub(byStretch(rounds, baseline)),
    putter: pair ? putterSub(pair) : null,
    birdie:
      b.tried >= MIN_BIRDIE
        ? {
            text:
              b.verdict === 'none'
                ? 'No clear gap yet'
                : b.verdict === 'lean'
                  ? `Leans ${b.better ? 'better' : 'worse'} for birdie`
                  : `${b.better ? 'Better' : 'Worse'} for birdie`,
            key: b.verdict === 'none' ? 'none' : `${b.verdict}:${b.better}`,
          }
        : null,
  };
}

export interface News {
  topic: string;
  title: string;
  sub: string;
}

/**
 * What this round changed on Stats: a page that just opened, or a finding that just became clear
 * or flipped. One item at most, so it stays rare enough to read.
 */
export function newsFrom(round: Round, all: Round[], putters: Putter[], baseline: [number, number][]): News | null {
  const after = real(all);
  const before = after.filter((r) => r.id !== round.id);
  if (before.length === after.length || !before.length) return null;

  const lockedBefore = locksFor(before, baseline);
  const lockedAfter = locksFor(after, baseline);
  const opened = Object.keys(lockedBefore).find((t) => !lockedAfter[t]);
  if (opened) return { topic: opened, title: `${TOPIC_TITLES[opened]} just opened`, sub: TOPIC_ABOUT[opened] };

  const was = findingsFor(before, putters, baseline);
  const now = findingsFor(after, putters, baseline);
  const changed = Object.keys(now).find((t) => {
    const n = now[t];
    return n && n.key.startsWith('clear') && was[t]?.key !== n.key;
  });
  return changed
    ? { topic: changed, title: `${TOPIC_TITLES[changed]} has a new finding`, sub: now[changed]!.text }
    : null;
}
