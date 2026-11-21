import { describe, expect, it } from 'vitest';
import { bleedLine, bleedsIn, bleedStory, liveBleed, mistakeStrokes } from './bleed';
import type { Hole, Putt, Round } from './types';

const putt = (d: number, made = false) => ({ d, made }) as Putt;
const hole = (n: number, strokes: number, putts: Putt[]): Hole => ({ hole: n, par: 4, strokes, putts });

describe('bleed', () => {
  // Missed a 5 footer on the 2nd, then bogey, bogey, par.
  const round = {
    id: 'r',
    date: '2026-11-19',
    finished: true,
    holes: [
      hole(1, 4, [putt(20), putt(1, true)]),
      hole(2, 5, [putt(5), putt(1, true)]),
      hole(3, 5, [putt(30), putt(3, true)]),
      hole(4, 5, [putt(12), putt(2, true)]),
      hole(5, 4, [putt(15), putt(1, true)]),
    ],
  } as unknown as Round;

  it('charges a mistake only the strokes on its own hole', () => {
    expect(mistakeStrokes(round.holes[1])).toBe(1);
    expect(mistakeStrokes(hole(9, 6, [putt(30), putt(4), putt(1, true)]))).toBe(1);
    expect(mistakeStrokes(round.holes[0])).toBe(0);
    expect(liveBleed(round).strokes).toBe(1);
  });

  it('tells what followed without charging it', () => {
    const [b] = bleedsIn(round);
    expect(b.shots).toBe(1);
    expect(b.holes).toEqual([3, 4]);
    expect(b.endHole).toBe(5);
    expect(bleedStory(b)).toBe('Missed 5 ft on the 2nd, 1 stroke. Then over par on 3 and 4.');
    expect(bleedLine(round)).toBe('Bled 1 · missed 5 ft on the 2nd');
  });
});
