import { breakBucket, breakDirsOf, type Hole, type Putt, type Round } from './types';

export interface ReadBand {
  /** 1 slight to 4 severe, how much the putt actually moved. */
  amount: number;
  putts: number;
  hadIt: number;
  under: number;
  over: number;
  /** Read the turn backwards. Counted apart: it is a different mistake, not a bigger one. */
  wrong: number;
  /** Average leave on the ones that missed, so a bad read has a price in feet. */
  avgLeave: number | null;
}

/** One side of the break on its own. Double breakers sit out: the error belongs to neither. */
export interface ReadSide {
  key: 'lr' | 'rl';
  label: string;
  putts: number;
  right: number;
  under: number;
  over: number;
  wrong: number;
}

export interface ReadSummary {
  /** Putts carrying both halves of the read. */
  judged: number;
  hadIt: number;
  under: number;
  over: number;
  wrong: number;
  bands: ReadBand[];
  sides: ReadSide[];
  /** Missed putts split the only way the three tags allow. */
  blameRead: number;
  blameStroke: number;
  blameSpeed: number;
  blamed: number;
  leaveWhenRight: number | null;
  leaveWhenWrong: number | null;
}

const leaveAfter = (hole: Hole, i: number): number | null => hole.putts[i + 1]?.d ?? null;

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/**
 * What the read tags say once they are crossed with the stroke flags. Push and pull are the
 * start line, so a miss with a right read and a clean start line is speed, one with a right
 * read and a push or pull is the stroke, and one with a wrong read is the read. That split is
 * the whole reason the read is logged.
 */
export function readError(rounds: Round[]): ReadSummary {
  const bands = new Map<number, { putts: number; hadIt: number; under: number; over: number; wrong: number; leaves: number[] }>();
  let judged = 0;
  let hadIt = 0;
  let under = 0;
  let over = 0;
  let wrong = 0;
  let blameRead = 0;
  let blameStroke = 0;
  let blameSpeed = 0;
  const rightLeaves: number[] = [];
  const wrongLeaves: number[] = [];
  const sides = new Map<'lr' | 'rl', { putts: number; right: number; under: number; over: number; wrong: number }>();

  for (const round of rounds) {
    for (const hole of round.holes) {
      hole.putts.forEach((p: Putt, i) => {
        if (p.readAs === undefined) return;
        const backwards = !!p.wrongWay;
        // Read break on a putt that rolled straight: it broke by nothing, so the delta is the
        // whole read and it lands as the largest over-read there is. No new field needed.
        const dirsOf = breakDirsOf(p);
        const neverTurned = !dirsOf.includes('L→R') && !dirsOf.includes('R→L');
        const broke = neverTurned ? 0 : p.brokeAs ?? p.readAs;
        // A backwards read has no magnitude error to measure, so delta is not asked for it.
        const delta = backwards ? null : broke - p.readAs;
        judged++;
        if (backwards) wrong++;
        else if (delta === 0) hadIt++;
        else if (delta! > 0) under++;
        else over++;

        const band = bands.get(broke) ?? { putts: 0, hadIt: 0, under: 0, over: 0, wrong: 0, leaves: [] };
        band.putts++;
        if (backwards) band.wrong++;
        else if (delta === 0) band.hadIt++;
        else if (delta! > 0) band.under++;
        else band.over++;

        const leave = p.made ? null : leaveAfter(hole, i);
        if (leave !== null) {
          band.leaves.push(leave);
          (delta === 0 ? rightLeaves : wrongLeaves).push(leave);
        }
        bands.set(broke, band);

        const bucket = breakBucket(breakDirsOf(p));
        if (bucket === 'lr' || bucket === 'rl') {
          const side = sides.get(bucket) ?? { putts: 0, right: 0, under: 0, over: 0, wrong: 0 };
          side.putts++;
          if (backwards) side.wrong++;
          else if (delta === 0) side.right++;
          else if (delta! > 0) side.under++;
          else side.over++;
          sides.set(bucket, side);
        }

        if (p.made) return;
        const offLine = !!p.push || !!p.pull;
        if (backwards || delta !== 0) blameRead++;
        else if (offLine) blameStroke++;
        else blameSpeed++;
      });
    }
  }

  return {
    judged,
    hadIt,
    under,
    over,
    wrong,
    bands: [...bands.entries()]
      .map(([amount, b]) => ({
        amount,
        putts: b.putts,
        hadIt: b.hadIt,
        under: b.under,
        over: b.over,
        wrong: b.wrong,
        avgLeave: mean(b.leaves),
      }))
      .sort((a, b) => a.amount - b.amount),
    sides: (['lr', 'rl'] as const)
      .map((key) => {
        const v = sides.get(key);
        return v ? { key, label: key === 'lr' ? 'L→R' : 'L←R', ...v } : null;
      })
      .filter((x): x is ReadSide => x !== null),
    blameRead,
    blameStroke,
    blameSpeed,
    blamed: blameRead + blameStroke + blameSpeed,
    leaveWhenRight: mean(rightLeaves),
    leaveWhenWrong: mean(wrongLeaves),
  };
}
