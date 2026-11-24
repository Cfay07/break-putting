import { describe, expect, it } from 'vitest';
import { keyOf, missesOf, recommended, redemption, REPLAY_ID, replayHistory, replayResult } from './replay';
import type { Hole, PracticeSet, Putt, Round } from './types';

const putt = (p: Partial<Putt> & { d: number; made: boolean }) => p as Putt;
const round = (id: string, date: string, holes: Hole[]) =>
  ({ id, date, finished: true, putterId: 'p', course: 'Strawberry Creek', holes }) as unknown as Round;

const lr = round('r1', '2026-11-19', [
  {
    hole: 2,
    putts: [
      putt({ d: 5, made: false, breakDirs: ['L→R', 'downhill'], missSide: 'low', push: true, readAs: 2, brokeAs: 3 }),
      putt({ d: 1, made: true }),
    ],
  },
  { hole: 9, putts: [putt({ d: 10, made: false, breakDirs: ['R→L'], speed: 'short' }), putt({ d: 1, made: true })] },
  { hole: 4, putts: [putt({ d: 30, made: false }), putt({ d: 2, made: false }), putt({ d: 1, made: true })] },
]);

describe('replay', () => {
  it('keeps only misses from 3 to 12 ft, and says what happened in plain words', () => {
    const ms = missesOf(lr);
    expect(ms.map((m) => m.d)).toEqual([5, 10]);
    expect(ms[0].label).toBe('5 ft, downhill, left to right');
    expect(ms[0].what).toBe('Missed low, pushed. You read 2, it broke 3.');
    expect(ms[0].setup).toBe('Find 5 ft breaking left to right, downhill. Play more break than it looks.');
    expect(ms[1].setup).toBe('Find 10 ft breaking right to left. Same line, get it to the hole.');
  });

  it('puts misses that match the target first', () => {
    const rec = recommended([lr], [], 'slice:short:lr', new Map());
    expect(rec[0].d).toBe(5);
    const other = recommended([lr], [], 'slice:mid:rl', new Map());
    expect(other.map((m) => m.d)).toEqual([5, 10]);
  });

  it('keeps each putt its own replay record, first tries only', () => {
    const of = { roundId: 'r1', hole: 2, putt: 0 };
    const set = (made: number, date: string, replayMiss?: 'low') =>
      ({
        id: date,
        date,
        drill: REPLAY_ID,
        surface: 'green',
        made,
        attempts: 1,
        replay: of,
        replayMiss,
      }) as PracticeSet;
    const h = replayHistory([set(0, '2026-11-20', 'low'), set(1, '2026-11-22')]).get(keyOf(of))!;
    expect(h).toEqual({ holed: 1, tries: 2, last: '2026-11-22', lastHoled: true, lastMiss: undefined });
  });

  it('says whether the replay repeated the course miss', () => {
    const m = missesOf(lr)[0];
    expect(replayResult(m, true)).toBe('Holed first try. On the course this one missed low.');
    expect(replayResult(m, false, 'low')).toBe('Low again. Same miss as the course.');
    expect(replayResult(m, false, 'high')).toBe('High this time. On the course it missed low.');
  });

  it('compares course putts of a replayed kind before and since the first replay', () => {
    const later = round('r2', '2026-11-25', [
      { hole: 1, putts: [putt({ d: 4, made: true, breakDirs: ['L→R'] })] },
      { hole: 2, putts: [putt({ d: 4, made: false, breakDirs: ['L→R'] }), putt({ d: 1, made: true })] },
    ]);
    const set = {
      id: 's',
      date: '2026-11-22',
      drill: REPLAY_ID,
      surface: 'green',
      made: 0,
      attempts: 1,
      replay: { roundId: 'r1', hole: 2, putt: 0 },
      replayMiss: 'low',
    } as PracticeSet;
    const [r] = redemption([lr, later], [], [set]);
    expect(r.label).toBe('Left-to-right putts, 3 to 5 ft');
    expect(r.before).toEqual({ made: 0, attempts: 1 });
    expect(r.after).toEqual({ made: 1, attempts: 2 });
    expect(r.verdict).toBe('early');
    expect(r.replays).toEqual({ holed: 0, tries: 1, same: 1, sided: 1 });
  });

  it('includes practice-round misses, marked as practice', () => {
    const rec = recommended([], [lr], null, new Map());
    expect(rec.every((m) => m.practice)).toBe(true);
  });
});
