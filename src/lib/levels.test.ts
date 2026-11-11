import { describe, expect, it } from 'vitest';
import { levels, markOf, readyToMove, withLevel } from './levels';
import type { DrillDef } from './types';

const drill = (extra: Partial<DrillDef> = {}): DrillDef =>
  ({ id: 'ten-4', name: 'Ten from 4 feet', scoring: 'count', stations: [{ d: 4, balls: 10 }], how: '', surfaces: ['indoor'], putting: true, source: 'app', ...extra }) as DrillDef;

describe('drills that keep pace with you', () => {
  it('only levels one-distance count drills', () => {
    expect(levels(drill())).toBe(true);
    expect(levels(drill({ stations: [{ d: 3, balls: 4 }, { d: 5, balls: 4 }] }))).toBe(false);
    expect(levels(drill({ shuffle: true }))).toBe(false);
  });

  it('moves every station back by the level', () => {
    expect(withLevel(drill(), { ft: 1 }).stations[0].d).toBe(5);
  });

  it('sets the mark where you land about two sets in three', () => {
    expect(markOf([5, 6])).toBeNull();
    expect(markOf([4, 6, 7, 8, 9])).toBe(6);
  });

  it('asks after two clears in a row, judged against the mark before them', () => {
    expect(readyToMove([5, 6, 7, 7, 8], undefined)).toBe(true);
    expect(readyToMove([5, 6, 7, 7, 4], undefined)).toBe(false);
  });

  it('waits after you chose to stay', () => {
    expect(readyToMove([5, 6, 7, 7, 8], { ft: 0, askAfter: 8 })).toBe(false);
  });
});
