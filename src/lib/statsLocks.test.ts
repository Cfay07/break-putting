import { describe, expect, it } from 'vitest';
import { locksFor, newsFrom } from './statsLocks';
import { DEFAULT_BASELINE, type GreenSpeed, type Putt, type Round } from './types';

const B = DEFAULT_BASELINE;
const putt = (d: number, made: boolean) => ({ d, made }) as Putt;

function round(id: string, date: string, greenSpeed?: GreenSpeed): Round {
  return {
    id,
    date,
    putterId: 'p',
    finished: true,
    greenSpeed,
    holes: Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      putts: i % 2 && i < 17 ? [putt(8, false), putt(4, true)] : [putt(35, false), putt(3, true)],
    })),
  } as unknown as Round;
}

describe('stats locks', () => {
  it('locks every page a first round cannot answer, and says how far to go', () => {
    const locks = locksFor([round('1', '2026-05-01', 'fast')], B);
    expect(locks.distance).toBeUndefined();
    expect(locks.lag).toBeUndefined();
    expect(locks.reads).toEqual({ how: 'Tag the read on your putts', need: '8 more putts' });
    expect(locks.greens).toEqual({ how: 'Pick the green speed on rounds at two speeds', need: '1 more speed' });
    expect(locks.pressure?.need).toBe('1 tournament');
    expect(locks.birdie?.need).toBe('30 more');
  });

  it('news names the page the latest round opened, and nothing for a round that opened none', () => {
    const first = round('1', '2026-05-01', 'fast');
    const second = round('2', '2026-05-02', 'medium');
    expect(newsFrom(second, [first, second], [], B)).toEqual({
      topic: 'greens',
      title: 'Greens just opened',
      sub: 'How you putt on slow, medium and fast greens, one putter at a time.',
    });
    const third = round('3', '2026-05-03', 'medium');
    expect(newsFrom(third, [first, second, third], [], B)).toBeNull();
  });
});
