import { describe, expect, it } from 'vitest';
import { beatTimes, isSilent } from './tempo';

describe('metronome', () => {
  it('splits a stroke two to one', () => {
    const [start, top, hit] = beatTimes({ stroke: 1.2, ratio: 2 });
    expect(start).toBe(0);
    expect(top).toBeCloseTo(0.8);
    expect(hit).toBeCloseTo(1.2);
  });
  it('keeps the stroke time whatever the ratio', () => {
    expect(beatTimes({ stroke: 1, ratio: 2.5 })[2]).toBe(1);
  });
  it('goes silent every third stroke only when fading', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => isSilent({ fade: true }, n))).toEqual([false, false, true, false, false, true]);
    expect(isSilent({ fade: false }, 2)).toBe(false);
  });
});
