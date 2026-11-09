import { describe, expect, it } from 'vitest';
import { beatTimes, FIND_START, isSilent, nextFind } from './tempo';

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

describe('finding your tempo', () => {
  it('slows the beat when it felt too fast and stops on two rights', () => {
    let s = nextFind(FIND_START, 'fast');
    expect(s.stroke).toBe(1.15);
    s = nextFind(s, 'right');
    expect(s.done).toBe(false);
    s = nextFind(s, 'right');
    expect([s.done, s.stroke]).toEqual([true, 1.15]);
  });
  it('takes smaller steps when the answers switch sides', () => {
    let s = nextFind(FIND_START, 'fast');
    s = nextFind(s, 'slow');
    expect(s.stroke).toBe(1.1);
    expect(s.step).toBe(0.05);
  });
  it('gives up after eight rounds and keeps the last speed', () => {
    let s = FIND_START;
    for (let i = 0; i < 8; i++) s = nextFind(s, i % 2 ? 'fast' : 'slow');
    expect(s.done).toBe(true);
  });
});
