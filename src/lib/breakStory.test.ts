import { describe, expect, it } from 'vitest';
import { breakStory, type Putt } from './types';
import { faultyOf } from './xp';

describe('breakStory', () => {
  it('tells a double breaker in the order it was tapped', () => {
    expect(breakStory(['R→L', 'uphill', 'L→R'])).toBe('Starts right to left, uphill. Finishes left to right.');
    expect(breakStory(['L→R', 'R→L'])).toBe('Starts left to right. Finishes right to left.');
  });

  it('says nothing when the putt only turns one way', () => {
    expect(breakStory(['L→R', 'downhill'])).toBeNull();
    expect(breakStory([])).toBeNull();
  });
});

describe('not committed', () => {
  const putt = (p: Partial<Putt>) => ({ d: 10, made: false, ...p }) as Putt;

  it('counts against a clean stroke only when it was said', () => {
    expect(faultyOf(putt({ uncommitted: true }))).toBe(true);
    expect(faultyOf(putt({ uncommitted: false }))).toBe(false);
    expect(faultyOf(putt({}))).toBe(false);
  });
});
