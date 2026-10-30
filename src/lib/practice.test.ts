import { describe, expect, it } from 'vitest';
import { replayLadder } from '../components/LadderLogger';
import { replayStreak } from '../components/StreakLogger';
import { APP_DRILLS, drillsFor, fitToRoom, resolveDrill } from './drills';
import { textLines } from './pdfText';
import { focusOf, leanOf, MIN_PUTTER_ROUNDS, playAt, RECENT_ROUNDS, trendOf } from './practice';
import { applyFilter, filterLabel } from './roundFilter';
import { readBlock, readSheet } from './sheetImport';
import { overall } from './stats';
import { reducer } from './store';
import { emptyState } from './storage';
import { DEFAULT_BASELINE, type DrillDef, type PracticeSet, type Putt, type Round } from './types';

const B = DEFAULT_BASELINE;

let day = 0;
/** Eighteen holes, each a first putt from `d` that is holed or missed to a tap-in. */
function round(putterId: string, d: number, makeEvery: number, extra: Partial<Round> = {}): Round {
  day++;
  const holes = Array.from({ length: 18 }, (_, i) => {
    const made = i % makeEvery === 0;
    const putts: Putt[] = made ? [{ d, made: true }] : [{ d, made: false }, { d: 1, made: true }];
    return { hole: i + 1, putts };
  });
  const date = `2026-${String(1 + Math.floor(day / 28)).padStart(2, '0')}-${String(1 + (day % 28)).padStart(2, '0')}`;
  return { id: `r${day}`, label: 'r', date, putterId, holeCount: 18, holes, finished: true, ...extra };
}

const set = (id: string, drill: string, made: number, attempts: number, date: string, extra: Partial<PracticeSet> = {}): PracticeSet => ({
  id, drill, made, attempts, date, surface: 'indoor', updated: `${date}T10:00:00Z`, ...extra,
});

describe('work on', () => {
  it('agrees with the strokes gained the Stats page shows', () => {
    const rounds = [round('a', 4, 2), round('a', 4, 3), round('a', 4, 2)];
    const f = focusOf(rounds, B, 'a');
    const sum = f.zones.reduce((s, z) => s + z.sgPerRound, 0);
    expect(sum).toBeCloseTo(overall(rounds, B).sgPerRound!, 6);
  });

  it('reads the current putter alone once it has enough rounds', () => {
    const old = [round('lab', 20, 9), round('lab', 20, 9), round('lab', 20, 9)];
    const now = Array.from({ length: MIN_PUTTER_ROUNDS }, () => round('cobra', 4, 2));
    const f = focusOf([...old, ...now], B, 'cobra');
    expect(f.putterOnly).toBe(true);
    expect(f.zones.find((z) => z.zone === 'lag')!.attempts).toBe(0);
  });

  it('chases the recent rounds, and names the old leak it moved past', () => {
    // A season of awful 4-footers, then ten rounds of holing them and missing from 7.
    const early = Array.from({ length: 8 }, () => round('a', 4, 9));
    const late = Array.from({ length: RECENT_ROUNDS }, () => round('a', 7, 6));
    late.forEach((r) => r.holes.slice(0, 9).forEach((h) => (h.putts = [{ d: 4, made: true }])));
    const f = focusOf([...early, ...late], B, 'a');
    expect(f.rounds).toBe(RECENT_ROUNDS);
    expect(f.allRounds).toBe(18);
    expect(f.worst).toBe('mid');
    expect(f.wasWorst?.zone).toBe('short');
  });

  it('never names a zone standing on a handful of putts', () => {
    const rounds = [round('a', 4, 3), round('a', 4, 3), round('a', 4, 3)];
    rounds[0].holes[0].putts = [{ d: 40, made: false }, { d: 9, made: false }, { d: 1, made: true }];
    expect(focusOf(rounds, B, 'a').worst).toBe('short');
  });
});

describe('lean', () => {
  const miss = (p: Partial<Putt>): Putt => ({ d: 5, made: false, ...p });
  it('names a habit covering half the tagged misses, and nothing under the minimum', () => {
    expect(leanOf([miss({ push: true }), miss({ pull: true })])).toBeNull();
    const putts = [miss({ push: true }), miss({ pull: true }), miss({ push: true }), miss({ pull: true }), miss({ speed: 'short' }), miss({ missSide: 'low' })];
    expect(leanOf(putts)).toEqual({ lean: 'start-line', n: 4, of: 6 });
  });
});

describe('drills and room', () => {
  it('moves stations in to the room and says where they were', () => {
    const lucky: DrillDef = { ...APP_DRILLS[0], id: 'l', scoring: 'ladder', stations: [3, 6, 15, 21].map((d) => ({ d, balls: 3 })) };
    const f = fitToRoom(lucky, 12)!;
    expect(f.stations.map((s) => s.d)).toEqual([3, 6, 12, 12]);
    expect(f.stations.map((s) => s.movedFrom)).toEqual([undefined, undefined, 15, 21]);
  });

  it('hides a drill that starts past the room rather than shrinking it into another drill', () => {
    expect(fitToRoom(APP_DRILLS.find((d) => d.id === 'two-putt-ladder')!, 12)).toBeNull();
  });

  it('sends the back-edge drill to the far end of the room', () => {
    expect(fitToRoom(APP_DRILLS.find((d) => d.id === 'back-edge')!, 14)!.stations[0].d).toBe(14);
  });

  it('only offers drills that fit the surface and the room', () => {
    for (const z of ['tapin', 'short', 'mid', 'long', 'lag'] as const) {
      for (const d of drillsFor(APP_DRILLS, z, null, 'indoor', 12)) {
        expect(d.surfaces).toContain('indoor');
        expect(Math.max(...d.stations.map((s) => s.d))).toBeLessThanOrEqual(12);
      }
    }
  });

  it('puts the drill for the habit first', () => {
    expect(drillsFor(APP_DRILLS, 'mid', 'start-line', 'indoor', 12)[0].id).toBe('gate-6');
  });

  it('lets your edited copy stand in for the original everywhere', () => {
    const copy: DrillDef = { ...APP_DRILLS[1], id: 'mine', source: 'mine', from: APP_DRILLS[1].id, name: 'Mine' };
    expect(resolveDrill({ drills: [copy] }, APP_DRILLS[1].id)?.name).toBe('Mine');
  });
});

describe('practice against play', () => {
  const r: Round = round('a', 10, 1);
  r.holes = [
    { hole: 1, putts: [{ d: 30, made: false }, { d: 2, made: true }] },
    { hole: 2, putts: [{ d: 30, made: false }, { d: 5, made: false }, { d: 1, made: true }] },
    { hole: 3, putts: [{ d: 6, made: true }] },
    { hole: 4, putts: [{ d: 6, made: false }, { d: 1, made: true }] },
  ];
  it('asks the course the same question the drill asked', () => {
    // The 5-footer on hole 2 is within a foot of 6, so it counts.
    expect(playAt([r], 6, 'make')).toEqual({ made: 1, attempts: 3 });
    expect(playAt([r], 30, 'twoputt')).toEqual({ made: 1, attempts: 2 });
    expect(playAt([r], 30, 'zone', 3)).toEqual({ made: 1, attempts: 2 });
  });
});

describe('getting better', () => {
  it('waits until both halves have enough balls', () => {
    expect(trendOf([set('a', 'x', 7, 10, '2026-11-01')]).verdict).toBe('waiting');
  });
  it('calls a change only when it beats the noise', () => {
    const flat = [1, 2, 3, 4, 5, 6].map((i) => set(`f${i}`, 'x', i % 2 ? 6 : 7, 10, `2026-11-0${i}`));
    expect(trendOf(flat).verdict).toBe('flat');
    const up = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => set(`u${i}`, 'x', i <= 4 ? 3 : 9, 10, `2026-11-0${i}`));
    expect(trendOf(up).verdict).toBe('up');
  });
});

describe('ladders and streaks', () => {
  const lucky = { stations: [{ d: 3, balls: 3, need: 3 }, { d: 9, balls: 3, need: 2 }], onMiss: 'end' as const };
  it('clears, fails and finishes the way the sheet says', () => {
    expect(replayLadder(lucky, [true, true, true]).at).toBe(1);
    expect(replayLadder(lucky, [true, false]).over).toBe(true);
    expect(replayLadder(lucky, [true, true, true, false, true, true]).finished).toBe(true);
    expect(replayLadder(lucky, [true, true, true, false, false]).over).toBe(true);
  });
  it('restarts or goes back a station when that is the rule', () => {
    expect(replayLadder({ ...lucky, onMiss: 'restart' }, [true, true, true, false, false]).at).toBe(0);
    expect(replayLadder({ ...lucky, onMiss: 'back' }, [true, true, true, false, false]).at).toBe(0);
    expect(replayLadder({ ...lucky, onMiss: 'stay' }, [true, true, true, false, false]).at).toBe(1);
  });
  it('counts a run and the misses that broke it', () => {
    expect(replayStreak([true, true, false, true, true, true, false, false])).toEqual({ current: 0, best: 3, restarts: 2 });
  });
});

describe('reading a practice sheet', () => {
  it('reads the common drill shapes', () => {
    expect(readBlock('Lucky 13 Drill (3 in a row from 3/ 2 out of 3 from 9/1 out of 3 from 15)').def.stations).toEqual([
      { d: 3, balls: 3, need: 3 },
      { d: 9, balls: 3, need: 2 },
      { d: 15, balls: 3, need: 1 },
    ]);
    const streak = readBlock('Make 20 putts in a row from 3 feet. Miss, start over. Did I succeed in 8 minutes').def;
    expect([streak.scoring, streak.target, streak.limit, streak.stations[0].d]).toEqual(['streak', 20, 8, 3]);
    expect(readBlock('Mirror and tee gates. 20 putts at 4 feet, 20 putts at 8 feet').def.stations).toEqual([
      { d: 4, balls: 20 },
      { d: 8, balls: 20 },
    ]);
  });
  it('marks a block it cannot read instead of guessing', () => {
    expect(readBlock('Stretch and hydrate before you start').read).toBe(false);
  });
  it('splits sessions on their names and keeps one drill used twice as one drill', () => {
    let n = 0;
    const r = readSheet(
      textLines(`Monday Putting Practice
Make 10 putts in a row from 3 feet
Gate putting. 10 putts at 6 feet
Tuesday Putting Practice
Make 10 putts in a row from 3 feet`),
      () => `d${++n}`,
    );
    expect(r.sessions.map((s) => s.name)).toEqual(['Monday Putting Practice', 'Tuesday Putting Practice']);
    expect(r.sessions[0].blocks[0].drill.id).toBe(r.sessions[1].blocks[0].drill.id);
    expect(r.drills).toHaveLength(2);
  });
});

describe('practice in the store', () => {
  it('never touches rounds', () => {
    const s0 = { ...emptyState(), rounds: [round('a', 4, 2)] };
    const s1 = reducer(s0, { t: 'addPracticeSet', set: set('p1', 'ten-4', 7, 10, '2026-11-01') });
    expect(s1.rounds).toBe(s0.rounds);
  });
  it('keeps a deleted set deleted when an older copy comes back', () => {
    const s1 = reducer(emptyState(), { t: 'addPracticeSet', set: set('p1', 'ten-4', 7, 10, '2026-11-01') });
    const s2 = reducer(s1, { t: 'deletePracticeSet', id: 'p1' });
    const stale = { ...set('p1', 'ten-4', 7, 10, '2026-11-01'), updated: '2026-01-01T00:00:00Z' };
    const s3 = reducer(s2, { t: 'applyIncoming', incoming: { rounds: [], putters: [], removed: [], practice: [stale] } });
    expect(s3.practice).toHaveLength(0);
  });
  it('moves a session on after a block, and stays put when a block is rolled again', () => {
    let s = reducer(emptyState(), {
      t: 'saveSession',
      session: { id: 'S', name: 'S', source: 'mine', blocks: [{ drill: 'ten-4' }, { drill: 'ten-6' }] },
    });
    s = reducer(s, { t: 'startRun', session: 'S', surface: 'indoor' });
    s = reducer(s, { t: 'finishBlock', block: 0, setId: 'a' });
    expect(s.run!.block).toBe(1);
    s = reducer(s, { t: 'finishBlock', block: 0, setId: 'b' });
    expect([s.run!.block, s.run!.done[0]]).toEqual([1, 'b']);
  });
  it('survives a backup from before practice existed', () => {
    const old = { ...emptyState() } as Partial<ReturnType<typeof emptyState>>;
    delete old.practice;
    delete old.drills;
    const s = reducer(emptyState(), { t: 'replaceState', state: old as ReturnType<typeof emptyState> });
    expect([s.practice, s.drills]).toEqual([[], []]);
  });
});

describe('stats filter', () => {
  const rs = [
    round('lab', 5, 2, { date: '2026-09-01' }),
    round('cobra', 5, 2, { date: '2026-10-01', competitive: true }),
    round('cobra', 5, 2, { date: '2026-10-20', greenSpeed: 'fast' }),
  ];
  it('applies every part together', () => {
    expect(applyFilter(rs, { kind: 'all', putterId: 'cobra' })).toHaveLength(2);
    expect(applyFilter(rs, { kind: 'competitive', putterId: 'cobra' })).toHaveLength(1);
    expect(applyFilter(rs, { kind: 'all', from: '2026-09-15', to: '2026-10-10' })).toHaveLength(1);
    expect(applyFilter(rs, { kind: 'all', greens: 'fast' })).toHaveLength(1);
  });
  it('says what it is showing', () => {
    expect(filterLabel({ kind: 'all' }, [])).toBe('All rounds');
    expect(filterLabel({ kind: 'casual', from: '2026-10-01' }, [])).toMatch(/^Casual · Since/);
  });
});

describe('fitting lag to a short room', () => {
  it('leaves lag stations out instead of shrinking them, and keeps the short ones', () => {
    const semi: DrillDef = {
      ...APP_DRILLS[1],
      id: 'semi',
      stations: [
        { d: 4, balls: 3 },
        { d: 15, balls: 3, mode: 'twoputt' },
        { d: 30, balls: 3, mode: 'twoputt' },
      ],
    };
    const f = fitToRoom(semi, 12)!;
    expect(f.stations.map((s) => s.d)).toEqual([4]);
    expect(f.dropped).toBe(2);
  });
});
