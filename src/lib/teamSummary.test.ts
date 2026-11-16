import { describe, expect, it } from 'vitest';
import { summarise } from './teamSummary';
import { emptyState } from './storage';
import type { Putt, Round } from './types';

const putt = (d: number, made: boolean) => ({ d, made }) as Putt;

describe('summarise', () => {
  it('sends a brand-new player live round with nothing finished yet', () => {
    const live = {
      id: 'live',
      label: 'live',
      date: '2026-11-16',
      putterId: 'p',
      holeCount: 18,
      finished: false,
      holes: [
        { hole: 1, par: 4, strokes: 4, putts: [putt(20, false), putt(2, true)] },
        { hole: 2, par: 4, strokes: 4, putts: [putt(8, true)] },
        { hole: 3, par: 4, strokes: 5, putts: [putt(30, false), putt(4, true)] },
      ],
    } as unknown as Round;
    const s = summarise({ ...emptyState(), rounds: [live] });
    expect(s.rounds).toBe(0);
    expect(s.sg_pr).toBeNull();
    expect(s.live).toMatchObject({ hole: 3, thru: 3, putts: 5, to_par: 1 });
    expect(s.live!.holes).toHaveLength(3);
    expect(s.live!.proj?.putts).toBe(30);
  });
});
