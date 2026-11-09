import type { PracticeSet } from './types';

/**
 * Tuning your tempo by results, blind. The tempo drill plays your saved speed or one a tenth of a
 * second either side, picked fresh each set and never shown, and scores it the way it always does:
 * balls finishing inside 3 ft. Speeds that do well get played more, the others keep getting a
 * look, and the saved tempo only moves when one speed is clearly better.
 *
 * Nothing is stored for this beyond the sets themselves: each set already keeps the stroke time
 * it was rolled at, so every phone works it out the same way.
 */
export const TUNE_DRILL = 'same-time';
export const TUNE_STEP = 0.1;
/** Balls at each speed before any of them can be called the winner. */
export const TUNE_MIN_BALLS = 24;
/** How sure it has to be that one speed is best before the saved tempo moves. */
export const TUNE_SURE = 0.9;

export interface TuneArm {
  stroke: number;
  made: number;
  attempts: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function candidates(center: number): number[] {
  const c = round2(Math.round(center * 20) / 20);
  return [c - TUNE_STEP, c, c + TUNE_STEP].map(round2).filter((s) => s >= 0.6 && s <= 1.6);
}

export function tuneArms(sets: PracticeSet[], center: number, familyOf: (id: string) => string = (id) => id): TuneArm[] {
  return candidates(center).map((stroke) => {
    const mine = sets.filter((s) => familyOf(s.drill) === TUNE_DRILL && s.tempo !== undefined && Math.abs(s.tempo - stroke) < 0.001);
    return {
      stroke,
      made: mine.reduce((n, s) => n + s.made, 0),
      attempts: mine.reduce((n, s) => n + s.attempts, 0),
    };
  });
}

type Rand = () => number;

/** A draw from what this speed's hit rate could plausibly be, given its balls so far. */
function draw(arm: TuneArm, rand: Rand): number {
  const a = arm.made + 1;
  const b = arm.attempts - arm.made + 1;
  const mean = a / (a + b);
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  // Box-Muller: close enough to the beta here, and a few lines instead of a library.
  const z = Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
  return mean + sd * z;
}

/** The speed to play next: each speed gets played about as often as it looks like the best one. */
export function pickStroke(arms: TuneArm[], rand: Rand = Math.random): number {
  let best = arms[0];
  let top = -Infinity;
  for (const arm of arms) {
    const v = draw(arm, rand);
    if (v > top) {
      top = v;
      best = arm;
    }
  }
  return best.stroke;
}

export interface TuneVerdict {
  /** The speed that is clearly best, or null while it is still too close to call. */
  winner: number | null;
  /** How often each speed came out on top across the draws. */
  chance: Record<string, number>;
  enough: boolean;
}

export function tuneVerdict(arms: TuneArm[], rand: Rand = Math.random, draws = 4000): TuneVerdict {
  const wins = new Map(arms.map((a) => [a.stroke, 0]));
  for (let i = 0; i < draws; i++) {
    let best = arms[0].stroke;
    let top = -Infinity;
    for (const arm of arms) {
      const v = draw(arm, rand);
      if (v > top) {
        top = v;
        best = arm.stroke;
      }
    }
    wins.set(best, (wins.get(best) ?? 0) + 1);
  }
  const chance = Object.fromEntries([...wins].map(([s, w]) => [s.toFixed(2), w / draws]));
  const enough = arms.every((a) => a.attempts >= TUNE_MIN_BALLS);
  const [lead, share] = [...wins].sort((a, b) => b[1] - a[1])[0];
  return { winner: enough && share / draws >= TUNE_SURE ? lead : null, chance, enough };
}
