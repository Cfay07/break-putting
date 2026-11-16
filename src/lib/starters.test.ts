import { describe, expect, it } from 'vitest';
import { APP_DRILLS, ballsText, distanceText, fitToRoom, scoringLabel } from './drills';
import { STARTERS } from './starters';

describe('starter sessions', () => {
  it('only use drills the app ships, so they run for a brand-new player', () => {
    const ids = new Set(APP_DRILLS.map((d) => d.id));
    for (const s of STARTERS) for (const b of s.blocks) expect(ids.has(b.drill), `${s.name}: ${b.drill}`).toBe(true);
  });
});

describe('drill labels', () => {
  const byId = (id: string) => APP_DRILLS.find((d) => d.id === id)!;

  it('say what a ball is judged on in plain words', () => {
    expect(scoringLabel(byId('ten-6'))).toBe('Holed');
    expect(scoringLabel(byId('run-3'))).toBe('In a row');
    expect(ballsText(byId('ten-6'))).toBe('10 putts');
  });

  it('list a long drill at the length you will actually putt indoors', () => {
    expect(distanceText(fitToRoom(byId('lag-ladder'), 12))).toBe('12 ft');
    expect(distanceText(fitToRoom(byId('back-edge'), 12))).toBe('12 ft');
  });
});
