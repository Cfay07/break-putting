import { statsForHoles } from './stats';
import { breakDirsOf, type Round } from './types';

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

/**
 * One colour per band, so the rail and the number are never two shades of the same idea, and a
 * real ramp with it: lightness runs 4, 10, 17, 17, 9, rising to the middle and falling again.
 *
 * The whole ramp lives inside the legible range on purpose. The bar is 3.0 rather than 4.5:
 * every place this colour becomes text it is large text, 21px bold on the card and 40px on the
 * round page, which is the threshold WCAG sets for the lower floor. The bands still sit at 4.0
 * and above, so there is real margin, and that headroom is what lets the middle be light enough
 * to ramp at all. Pure amber at full brightness scores 2.01 and remains out of reach.
 */
export const FORM_BANDS = [
  { min: 8, name: 'Dark green', ink: '#15603b' },
  { min: 6, name: 'Green', ink: '#2c8c54' },
  { min: 4, name: 'Amber', ink: '#96690a' },
  { min: 2, name: 'Red', ink: '#a52a1f' },
  { min: 0, name: 'Dark red', ink: '#6e1a12' },
] as const;

export function formBand(score: number) {
  return FORM_BANDS.find((b) => score >= b.min) ?? FORM_BANDS[FORM_BANDS.length - 1];
}

/**
 * Strokes gained per eighteen onto nought to ten, the way a real rating behaves rather than a
 * straight line. Match ratings and review scores crowd the middle and give the top away almost
 * never, so the curve stretches where rounds actually land and flattens hard above it: tour
 * average is a 7.5, and a ten needs ten shots a round better than tour, which nobody does.
 *
 * Fixed anchors on purpose. Calibrating to the player's own history would park everyone at the
 * middle forever and could never show improvement.
 */
const CURVE: [number, number][] = [
  [-12, 0],
  [-7, 3],
  [-3, 5.5],
  [0, 7.5],
  [2, 8.7],
  [5, 9.5],
  [8, 10],
];

function fromSG(sg18: number): number {
  if (sg18 <= CURVE[0][0]) return 0;
  if (sg18 >= CURVE[CURVE.length - 1][0]) return 10;
  for (let i = 1; i < CURVE.length; i++) {
    const [x1, y1] = CURVE[i];
    if (sg18 <= x1) {
      const [x0, y0] = CURVE[i - 1];
      return y0 + ((sg18 - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 10;
}

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

const neverTurnedOf = (p: { breakDirs?: string[]; breakDir?: string }) => {
  const dirs = breakDirsOf(p as never);
  return !dirs.includes('L→R') && !dirs.includes('R→L');
};

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
        const unfinished = !neverTurnedOf(p) && p.readAs === 0 && p.brokeAs === undefined;
        if (unfinished) {
          // counted as tagged, judged on nothing
        } else {
        parts.read.of++;
        touched = true;
        const neverTurned = neverTurnedOf(p);
        const wrong =
          !!p.wrongWay ||
          neverTurned ||
          (p.brokeAs !== undefined && p.brokeAs !== p.readAs);
        if (!wrong) parts.read.right++;
        }
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
      // Quitting on it and jabbing at it are pace faults with a cause attached, and they were
      // feeding nothing at all before: tagged, counted on the stats page, and invisible here.
      const tempo = !!p.decel || !!p.accel;
      if (p.speed || tempo) {
        parts.pace.of++;
        if (p.speed === 'good' && !tempo) parts.pace.right++;
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
