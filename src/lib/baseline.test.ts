import { describe, expect, it } from 'vitest';
import { DEFAULT_BASELINE, tracedBaseline } from './types';

describe('the tour baseline', () => {
  it('matches the traced tour table from 30 ft out', () => {
    const at = (d: number) => DEFAULT_BASELINE.find(([x]) => x === d)?.[1];
    expect([at(30), at(40), at(50), at(60)]).toEqual([1.98, 2.06, 2.14, 2.21]);
  });

  it('moves a saved copy of the old default onto it, and leaves an edited table alone', () => {
    const old = DEFAULT_BASELINE.map(([d, v]) => [d, d === 30 ? 2.0 : v] as [number, number]);
    expect(tracedBaseline(old)).toBe(DEFAULT_BASELINE);
    const mine = old.map(([d, v]) => [d, d === 10 ? 1.7 : v] as [number, number]);
    expect(tracedBaseline(mine)).toBe(mine);
  });
});
