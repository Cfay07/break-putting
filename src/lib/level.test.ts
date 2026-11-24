import { describe, expect, it } from 'vitest';
import { levelOf } from './level';
import type { Hole, Putt, Round } from './types';

const putt = (d: number, made: boolean) => ({ d, made }) as Putt;

function holesFrom(d: number, n: number, makes: number): Hole[] {
  return Array.from({ length: n }, (_, i) => ({
    hole: i + 1,
    putts: i < makes ? [putt(d, true)] : [putt(d, false), putt(2, true)],
  }));
}

const round = (holes: Hole[]) =>
  ({ id: 'r', date: '2026-05-01', finished: true, putterId: 'p', holes }) as unknown as Round;

describe('the 50% distance', () => {
  it('waits for enough first putts', () => {
    expect(levelOf([round(holesFrom(6, 50, 25))])).toBeNull();
  });

  it('finds where half your first putts go in', () => {
    const r = round([
      ...holesFrom(3, 30, 27),
      ...holesFrom(6, 30, 15),
      ...holesFrom(12, 30, 6),
      ...holesFrom(25, 30, 2),
      ...holesFrom(40, 30, 1),
    ]);
    const l = levelOf([r])!;
    expect(l.d50).toBeGreaterThan(5);
    expect(l.d50).toBeLessThan(7);
  });
});
