import { describe, expect, it } from 'vitest';
import { levelOf, levelStory, placeText } from './level';
import type { Hole, Putt, Round } from './types';

const putt = (d: number, made: boolean) => ({ d, made }) as Putt;

/** Holes from each distance: the first `makes` holed, the rest two-putted, every `threeEvery`th three-putted. */
function holesFrom(d: number, n: number, makes: number, threes = 0): Hole[] {
  return Array.from({ length: n }, (_, i) => ({
    hole: i + 1,
    putts:
      i < makes
        ? [putt(d, true)]
        : i < n - threes
          ? [putt(d, false), putt(2, true)]
          : [putt(d, false), putt(5, false), putt(1, true)],
  }));
}

const round = (holes: Hole[]) =>
  ({ id: 'r', date: '2026-05-01', finished: true, putterId: 'p', holes }) as unknown as Round;

describe('where you stand', () => {
  it('waits for enough first putts', () => {
    expect(levelOf([round(holesFrom(6, 50, 25))])).toBeNull();
  });

  it('finds the half-way distance and the two-putt distance from the putts', () => {
    const r = round([
      ...holesFrom(3, 30, 27),
      ...holesFrom(6, 30, 15),
      ...holesFrom(12, 30, 6),
      ...holesFrom(25, 30, 2, 2),
      ...holesFrom(40, 30, 1, 8),
    ]);
    const l = levelOf([r])!;
    expect(l.d50).toBeGreaterThan(5);
    expect(l.d50).toBeLessThan(7);
    expect(l.d2).not.toBeNull();
    expect(levelStory(l)).toMatch(/^You make 50% of your first putts from \d+\.\d ft\. That's /);
  });

  it('places a range among the groups in plain words', () => {
    expect(placeText(6.3)).toBe(
      "That's farther out than golfers who shoot 70 to 83 (5.8 ft) and closer in than tour players (8.2 ft).",
    );
    expect(placeText(9)).toBe("Tour players do it from 8.2 ft, so you're at tour level.");
    expect(placeText(2.8)).toBe("That's closer in than golfers who shoot 97 to 120 (3.8 ft).");
  });
});
