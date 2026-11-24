import { describe, expect, it } from 'vitest';
import { matchRounds, planRestore } from './restore';
import type { Round } from './types';

const round = (id: string, date: string, holeCount = 18) => ({ id, date, holeCount }) as Round;

describe('restoring from a backup', () => {
  it('keeps both rounds of a 36-hole day when the file has only one of them', () => {
    const here = [round('am', '2026-11-01'), round('pm', '2026-11-01')];
    const plan = planRestore(here, [round('am', '2026-11-01')]);
    expect(plan.fresh).toEqual([]);
    expect(plan.kept.map((r) => r.id)).toEqual(['pm']);
  });

  it('adds the second round of a 36-hole day instead of calling it a copy', () => {
    const here = [round('am', '2026-11-01')];
    const plan = planRestore(here, [round('am', '2026-11-01'), round('pm', '2026-11-01')]);
    expect(plan.fresh.map((r) => r.id)).toEqual(['pm']);
  });

  it('still pairs a round whose id changed, when that day holds only one round', () => {
    expect(matchRounds([round('old', '2026-11-02')], [round('new', '2026-11-02')]).get('new')).toBe('old');
  });

  it('does not guess between two rounds on one day when ids changed', () => {
    const here = [round('a', '2026-11-01'), round('b', '2026-11-01')];
    const plan = planRestore(here, [round('x', '2026-11-01'), round('y', '2026-11-01')]);
    expect(plan.fresh.map((r) => r.id)).toEqual(['x', 'y']);
    expect(plan.kept).toHaveLength(2);
  });

  it('tells a 9 from an 18 on the same day', () => {
    const plan = planRestore([round('a', '2026-11-03', 9)], [round('b', '2026-11-03', 18)]);
    expect(plan.fresh.map((r) => r.id)).toEqual(['b']);
  });
});
