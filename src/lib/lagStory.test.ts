import { describe, expect, it } from 'vitest';
import { bestLags, lagByLength, lagsOf, lagTrend, lagTrendStory, worstLags } from './lagStory';
import type { Hole, Putt, Round } from './types';

const putt = (d: number, made: boolean) => ({ d, made }) as Putt;

/** A round of four 40-footers, `good` of them left at 2 ft and the rest at 8 ft. */
function round(id: string, date: string, good: number): Round {
  const holes: Hole[] = Array.from({ length: 4 }, (_, i) => ({
    hole: i + 1,
    putts: [putt(40, false), putt(i < good ? 2 : 8, true)],
  }));
  return { id, date, finished: true, putterId: 'p', holes } as unknown as Round;
}

describe('lag story', () => {
  const rounds = [
    round('a', '2026-10-01', 4),
    round('b', '2026-10-02', 4),
    round('c', '2026-10-03', 1),
    round('d', '2026-10-04', 1),
    round('e', '2026-10-05', 0),
    round('f', '2026-10-06', 4),
  ];

  it('starts the trend only once ten lags sit behind a point', () => {
    const points = lagTrend(rounds);
    expect(points[0].date).toBe('2026-10-03');
    expect(points[0].lags).toBe(12);
  });

  it('names the swing when the trend moved', () => {
    expect(lagTrendStory(lagTrend(rounds))).toMatch(
      /^Over your last 5 rounds, \d+% of your lags finished inside 10%\./,
    );
    expect(lagTrendStory([])).toBeNull();
  });

  it('lists the best and worst leaves, and splits only with enough on each side', () => {
    const lags = lagsOf(rounds);
    expect(bestLags(lags)[0].leave).toBe(2);
    expect(worstLags(lags).every((l) => l.leave === 8)).toBe(true);
    expect(lagByLength(lags)).toEqual([]);
  });
});
