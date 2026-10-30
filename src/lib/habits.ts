import { bleedSummary } from './bleed';
import { fixFor } from './pinpoint';
import { readError } from './readError';
import { byStrike } from './stats';
import type { Round, Surface } from './types';

/**
 * Habits that are not about a distance: how you read, where you start it, how you strike it,
 * whether the stroke quits, and what a three-putt does to the next hole. Each one only speaks
 * past its own minimum and only gets a drill that works on that habit. Most players will see
 * none of these for a while, and that is the honest answer.
 */
export interface Habit {
  key: 'read' | 'start' | 'lip' | 'strike' | 'decel' | 'bleed';
  title: string;
  detail: string;
  fix: string;
  /** For ordering: how lopsided the habit is, nought to one. */
  weight: number;
}

const READ_NEED = 12;
const START_NEED = 8;
const LIP_NEED = 8;
const STRIKE_NEED = 15;
const DECEL_NEED = 6;
const BLEED_NEED = 20;

export function habitsOf(rounds: Round[], surface: Surface): Habit[] {
  const out: Habit[] = [];

  // Reads: per side of the break, so a left-to-right problem is not averaged away by the other.
  const reads = readError(rounds);
  for (const side of reads.sides) {
    if (side.putts < READ_NEED) continue;
    const way = side.key === 'lr' ? 'left-to-right' : 'right-to-left';
    for (const [n, word, verb] of [
      [side.under, 'under', 'read less break than they had'],
      [side.over, 'over', 'read more break than they had'],
    ] as const) {
      if (n * 2 < side.putts) continue;
      out.push({
        key: 'read',
        title: `You ${word}-read ${way} putts`,
        detail: `${n} of the ${side.putts} ${way} putts with a read logged ${verb}; ${side.right} you had right.`,
        fix: fixFor(side.key, word === 'under' ? 'low' : 'high', 8, surface),
        weight: n / side.putts,
      });
    }
  }

  let push = 0;
  let pull = 0;
  let lips = 0;
  let shortMisses = 0;
  let decel = 0;
  let faultTagged = 0;
  for (const r of rounds) {
    for (const h of r.holes) {
      for (const p of h.putts) {
        if (p.made) continue;
        if (p.push) push++;
        if (p.pull) pull++;
        if (p.decel) decel++;
        if (p.push || p.pull || p.decel || p.accel || p.lip) faultTagged++;
        if (p.d >= 3 && p.d <= 10) {
          shortMisses++;
          if (p.lip) lips++;
        }
      }
    }
  }

  const line = push + pull;
  if (line >= START_NEED && Math.max(push, pull) >= line * 0.75) {
    const word = push > pull ? 'push' : 'pull';
    out.push({
      key: 'start',
      title: `You ${word} it`,
      detail: `${Math.max(push, pull)} of your ${line} start-line misses were ${word}es. The gate shows it on every ball.`,
      fix: fixFor(null, 'start-line', 6, surface),
      weight: Math.max(push, pull) / line,
    });
  }

  if (lips >= LIP_NEED && lips >= shortMisses * 0.2) {
    out.push({
      key: 'lip',
      title: 'Short putts catching the edge',
      detail: `${lips} of your ${shortMisses} misses from 3 to 10 ft lipped out. A firmer roll takes the edge out of play.`,
      fix: fixFor(null, 'short', 5, surface),
      weight: lips / shortMisses,
    });
  }

  const strikes = byStrike(rounds);
  const struck = strikes.reduce((n, s) => n + s.putts, 0);
  const off = strikes.filter((s) => s.key !== 'centre').reduce((n, s) => n + s.putts, 0);
  if (struck >= STRIKE_NEED && off >= struck * 0.4) {
    out.push({
      key: 'strike',
      title: 'Off the middle of the face',
      detail: `${off} of your ${struck} tagged strikes were toe or heel.`,
      fix: 'fix:strike:6',
      weight: off / struck,
    });
  }

  if (decel >= DECEL_NEED && decel >= faultTagged * 0.25) {
    out.push({
      key: 'decel',
      title: 'The stroke quits on it',
      detail: `${decel} of your ${faultTagged} misses with a fault tagged were decel.`,
      fix: 'fix:accel:6',
      weight: decel / faultTagged,
    });
  }

  // After a three-putt: only when the drop is bigger than chance, never on a handful of holes.
  const bleed = bleedSummary(rounds);
  if (bleed.sample >= BLEED_NEED && bleed.afterRate !== null && bleed.normalRate !== null) {
    const p1 = bleed.afterRate;
    const p2 = bleed.normalRate;
    const margin = 1.96 * Math.sqrt((p1 * (1 - p1)) / bleed.sample + (p2 * (1 - p2)) / Math.max(bleed.sample, 1));
    if (p2 - p1 > margin) {
      out.push({
        key: 'bleed',
        title: 'A three-putt follows you to the next hole',
        detail: `Par or better ${Math.round(p1 * 100)}% of the time right after one, against ${Math.round(p2 * 100)}% otherwise, over ${bleed.sample} holes.`,
        fix: 'run-3',
        weight: p2 - p1,
      });
    }
  }

  return out.sort((a, b) => b.weight - a.weight);
}
