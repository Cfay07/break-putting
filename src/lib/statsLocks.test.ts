import { describe, expect, it } from 'vitest';
import { locksFor, newsFrom } from './statsLocks';
import { DEFAULT_BASELINE, type GreenSpeed, type Putt, type Round } from './types';

const B = DEFAULT_BASELINE;
const putt = (d: number, made: boolean) => ({ d, made }) as Putt;

function round(id: string, date: string, greenSpeed?: GreenSpeed, extra: Partial<Round> = {}): Round {
  return {
    id,
    date,
    putterId: 'p',
    finished: true,
    greenSpeed,
    ...extra,
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

  it('keeps Greens shut until one putter has 20 short putts at a second speed', () => {
    // Each test round has 26 putts from 3 to 10 ft.
    const thin = { ...round('2', '2026-05-02', 'medium'), holes: round('2', '2026-05-02').holes.slice(0, 2) };
    expect(locksFor([round('1', '2026-05-01', 'fast'), thin], B).greens?.need).toMatch(/^\d+ more at a second speed$/);
    const otherPutter = round('3', '2026-05-03', 'medium', { putterId: 'q' });
    expect(locksFor([round('1', '2026-05-01', 'fast'), otherPutter], B).greens?.need).toBe('20 more at a second speed');
    expect(locksFor([round('1', '2026-05-01', 'fast'), round('2', '2026-05-02', 'medium')], B).greens).toBeUndefined();
  });

  it('keeps Tournament vs casual shut until one putter has three of each', () => {
    const t = (id: string) => round(id, `2026-05-0${id}`, 'fast', { competitive: true });
    const c = (id: string) => round(id, `2026-05-0${id}`, 'fast');
    expect(locksFor([t('1'), c('2')], B).pressure?.need).toBe('2 more tournament, 2 more casual');
    expect(locksFor([t('1'), t('2'), t('3'), c('4')], B).pressure?.need).toBe('2 more casual');
    expect(locksFor([t('1'), t('2'), t('3'), c('4'), c('5'), c('6')], B).pressure).toBeUndefined();
  });
});
