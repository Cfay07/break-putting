import { statsForHoles } from './stats';
import type { Round } from './types';

/**
 * Form scores how you putted. Strokes gained scores what the ball did. They disagree on exactly
 * the putts that matter: a toe strike that drops is paid by one and not the other, and a putt
 * read right and struck in the middle that slides by is docked by one and not the other.
 *
 * Two layers. The outcome layer is strokes gained, which every round has. The process layer is
 * the tags, which only a tagged round has. A round without tags still gets a number, drawn
 * faint, because an outcome-only reading is a lesser measurement and should not look like the
 * full one.
 *
 * Conditions deliberately feed nothing. Green speed, bumpiness and aeration stay labels on the
 * round, because the number has to mean the same thing everywhere to be worth having.
 */

/** Below this a made putt never reached the tagging screen, so it can carry no process. */
const LONG_MAKE = 4;
/**
 * Enough tagged putts in one round for the process layer to speak. Only a read or a strike
 * counts towards it: pace and start line get logged as part of tagging an ordinary miss, so
 * letting them unlock the layer would mark nearly every round as fully measured and the faint
 * rail would stop meaning anything.
 */
export const MIN_TAGGED = 6;

/** Rail colour is vibrant and carries no text. Ink is the darker step, for text on the card. */
export const FORM_BANDS = [
  { min: 8, name: 'Green', rail: '#1f7a4d', ink: '#1f7a4d' },
  { min: 6, name: 'Yellow-green', rail: '#93bb2e', ink: '#5a7016' },
  { min: 4, name: 'Amber', rail: '#e0a526', ink: '#8a6208' },
  { min: 2, name: 'Orange-red', rail: '#b0431a', ink: '#b0431a' },
  { min: 0, name: 'Red', rail: '#a52a1f', ink: '#a52a1f' },
] as const;

export function formBand(score: number) {
  return FORM_BANDS.find((b) => score >= b.min) ?? FORM_BANDS[FORM_BANDS.length - 1];
}

/**
 * Strokes gained per eighteen onto nought to ten. Fixed anchors on purpose: calibrating to the
 * player's own history would park everyone at the middle forever and never show improvement.
 * Ten is roughly two shots better than tour per eighteen, nought is twelve worse.
 */
const BEST = 2;
const WORST = -12;
const fromSG = (sg18: number) =>
  Math.max(0, Math.min(10, ((sg18 - WORST) / (BEST - WORST)) * 10));

export interface Tally {
  right: number;
  of: number;
}

export interface FormParts {
  read: Tally;
  strike: Tally;
  line: Tally;
  pace: Tally;
  /** Lip-outs. The clearest case in the game of doing it right and not being paid. */
  lip: Tally;
}

export interface Form {
  score: number;
  outcome: number;
  /** Null when the round has too few tagged putts for process to mean anything. */
  process: number | null;
  /** Putts that contributed at least one tagged component. */
  tagged: number;
  parts: FormParts;
  sg18: number;
}

const empty = (): Tally => ({ right: 0, of: 0 });

export function formOf(round: Round, baseline: [number, number][]): Form | null {
  const s = statsForHoles(round.holes, baseline);
  // A round with no putts says nothing about putting, whatever its strokes gained reads.
  if (!s.totalPutts || !s.holesPlayed) return null;

  const sg18 = (s.sg / s.holesPlayed) * 18;
  const outcome = fromSG(sg18);

  const parts: FormParts = {
    read: empty(), strike: empty(), line: empty(), pace: empty(), lip: empty(),
  };
  let tagged = 0;

  for (const hole of round.holes) {
    for (const p of hole.putts) {
      // Tap-ins never reach the tagging screen, so counting them would only dilute.
      if (p.made && p.d < LONG_MAKE) continue;
      let touched = false;

      if (p.readAs !== undefined) {
        parts.read.of++;
        touched = true;
        const wrong = !!p.wrongWay || (p.brokeAs !== undefined && p.brokeAs !== p.readAs);
        if (!wrong) parts.read.right++;
      }
      if (p.strike) {
        parts.strike.of++;
        touched = true;
        if (p.strike === 'centre') parts.strike.right++;
      }
      // Everything below still scores, but none of it counts towards the gate.
      // Start line only counts where it was looked at, which is a tagged putt.
      if (p.push || p.pull || p.readAs !== undefined || p.strike) {
        parts.line.of++;
        if (!p.push && !p.pull) parts.line.right++;
      }
      if (p.speed) {
        parts.pace.of++;
        if (p.speed === 'good') parts.pace.right++;
      }
      if (p.lip) {
        parts.lip.of++;
        parts.lip.right++;
      }

      if (touched) tagged++;
    }
  }

  const totals = Object.values(parts).reduce(
    (a, t) => ({ right: a.right + t.right, of: a.of + t.of }),
    { right: 0, of: 0 },
  );
  const process = tagged >= MIN_TAGGED && totals.of ? (totals.right / totals.of) * 10 : null;

  // Half and half when both exist. Process is the point of the metric, outcome is the half
  // everyone already trusts, and neither alone is the whole story of a round.
  const score = process === null ? outcome : outcome * 0.5 + process * 0.5;

  return { score, outcome, process, tagged, parts, sg18 };
}
