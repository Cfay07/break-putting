import { describe, expect, it } from 'vitest';
import { beatsBefore } from './useTarget';

describe('closing a target', () => {
  it('waits for ten course putts since it was set', () => {
    expect(beatsBefore({ made: 5, attempts: 14 }, { made: 9, attempts: 9 })).toBe(false);
  });
  it('calls it fixed when the gap is past chance', () => {
    expect(beatsBefore({ made: 5, attempts: 14 }, { made: 11, attempts: 15 })).toBe(true);
  });
  it('does not call a small gain fixed', () => {
    expect(beatsBefore({ made: 5, attempts: 14 }, { made: 6, attempts: 12 })).toBe(false);
  });
});
