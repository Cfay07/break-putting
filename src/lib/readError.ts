import type { Hole, Putt, Round } from './types';

export interface ReadBand {
  /** 1 slight to 4 severe, how much the putt actually moved. */
  amount: number;
  putts: number;
  hadIt: number;
  under: number;
  over: number;
  /** Average leave on the ones that missed, so a bad read has a price in feet. */
  avgLeave: number | null;
}

export interface ReadSummary {
  /** Putts carrying both halves of the read. */
  judged: number;
  hadIt: number;
  under: number;
  over: number;
  bands: ReadBand[];
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
  const bands = new Map<number, { putts: number; hadIt: number; under: number; over: number; leaves: number[] }>();
  let judged = 0;
  let hadIt = 0;
  let under = 0;
  let over = 0;
  let blameRead = 0;
  let blameStroke = 0;
  let blameSpeed = 0;
  const rightLeaves: number[] = [];
  const wrongLeaves: number[] = [];

  for (const round of rounds) {
    for (const hole of round.holes) {
      hole.putts.forEach((p: Putt, i) => {
        if (p.readAs === undefined) return;
        const broke = p.brokeAs ?? p.readAs;
        const delta = broke - p.readAs;
        judged++;
        if (delta === 0) hadIt++;
        else if (delta > 0) under++;
        else over++;

        const band = bands.get(broke) ?? { putts: 0, hadIt: 0, under: 0, over: 0, leaves: [] };
        band.putts++;
        if (delta === 0) band.hadIt++;
        else if (delta > 0) band.under++;
        else band.over++;

        const leave = p.made ? null : leaveAfter(hole, i);
        if (leave !== null) {
          band.leaves.push(leave);
          (delta === 0 ? rightLeaves : wrongLeaves).push(leave);
        }
        bands.set(broke, band);

        if (p.made) return;
        const offLine = !!p.push || !!p.pull;
        if (delta !== 0) blameRead++;
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
    bands: [...bands.entries()]
      .map(([amount, b]) => ({
        amount,
        putts: b.putts,
        hadIt: b.hadIt,
        under: b.under,
        over: b.over,
        avgLeave: mean(b.leaves),
      }))
      .sort((a, b) => a.amount - b.amount),
    blameRead,
    blameStroke,
    blameSpeed,
    blamed: blameRead + blameStroke + blameSpeed,
    leaveWhenRight: mean(rightLeaves),
    leaveWhenWrong: mean(wrongLeaves),
  };
}
