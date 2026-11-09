import { describe, expect, it } from 'vitest';
import { candidates, pickStroke, tuneArms, tuneVerdict, type TuneArm } from './tempoTune';
import type { PracticeSet } from './types';

/** A seeded generator, so the draws are the same every run. */
function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const set = (tempo: number, made: number, attempts = 12, drill = 'same-time'): PracticeSet =>
  ({ id: `${tempo}-${made}-${Math.random()}`, date: '2026-11-09', drill, surface: 'indoor', made, attempts, tempo }) as PracticeSet;

describe('tempo tuning', () => {
  it('tests the saved speed and a tenth either side', () => {
    expect(candidates(1.07)).toEqual([0.95, 1.05, 1.15]);
  });

  it('only counts the tempo drill at those speeds', () => {
    const arms = tuneArms([set(1.05, 7), set(1.15, 5), set(1.05, 9, 12, 'ten-4'), set(1.3, 12)], 1.05);
    expect(arms.map((a) => [a.stroke, a.made, a.attempts])).toEqual([
      [0.95, 0, 0],
      [1.05, 7, 12],
      [1.15, 5, 12],
    ]);
  });

  it('keeps giving every speed a look before there is any data', () => {
    const arms: TuneArm[] = candidates(1.05).map((stroke) => ({ stroke, made: 0, attempts: 0 }));
    const rand = seeded();
    const picks = new Set(Array.from({ length: 60 }, () => pickStroke(arms, rand)));
    expect(picks.size).toBe(3);
  });

  it('calls no winner while the speeds are close', () => {
    const arms: TuneArm[] = [
      { stroke: 0.95, made: 14, attempts: 30 },
      { stroke: 1.05, made: 15, attempts: 30 },
      { stroke: 1.15, made: 13, attempts: 30 },
    ];
    expect(tuneVerdict(arms, seeded()).winner).toBeNull();
  });

  it('calls a clear winner and waits for enough balls first', () => {
    const clear: TuneArm[] = [
      { stroke: 0.95, made: 8, attempts: 36 },
      { stroke: 1.05, made: 12, attempts: 36 },
      { stroke: 1.15, made: 28, attempts: 36 },
    ];
    expect(tuneVerdict(clear, seeded()).winner).toBe(1.15);
    const early = clear.map((a) => ({ ...a, attempts: 12, made: Math.round(a.made / 3) }));
    expect(tuneVerdict(early, seeded()).winner).toBeNull();
  });
});
