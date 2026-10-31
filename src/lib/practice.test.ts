import { describe, expect, it } from 'vitest';
import { replayLadder } from '../components/LadderLogger';
import { replayStreak } from '../components/StreakLogger';
import { APP_DRILLS, drillsFor, fitToRoom, resolveDrill } from './drills';
import { carryRows, carryText } from './carry';
import { habitsOf } from './habits';
import { roundPayoff, roundTags } from './roundPayoff';
import { targetKind } from './target';
import { missBands, pressureOf, spotVsMixed, testTrend } from './practiceReview';
import { setupOf, TEST_ID, testBalls, testDrill, testStatus, weekOf } from './weeklyTest';
import { handGap, handLink, handsOf } from './hands';
import { fixDrill, fixFor, pinpoint, practiceFix, practicePattern } from './pinpoint';
import { textLines } from './pdfText';
import { focusOf, leanOf, MIN_PUTTER_ROUNDS, playAt, practiceVsPlay, RECENT_ROUNDS, runLapsed, trendOf } from './practice';
import { applyFilter, filterLabel } from './roundFilter';
import { readBlock, readSheet } from './sheetImport';
import { signedFor, sample } from './sample';
import { tallyStations } from './practiceView';
import { overall } from './stats';
import { backLabel, nextTrail } from './router';
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
    const f = fitToRoom(lucky, 12);
    expect(f.stations.map((s) => s.d)).toEqual([3, 6, 12, 12]);
    expect(f.stations.map((s) => s.movedFrom)).toEqual([undefined, undefined, 15, 21]);
  });

  it('reshapes a drill that starts past the room instead of hiding it', () => {
    const f = fitToRoom(APP_DRILLS.find((d) => d.id === 'two-putt-ladder')!, 12);
    expect(f.stations.map((s) => [s.d, s.movedFrom])).toEqual([[12, 20], [12, 30], [12, 40]]);
  });

  it('sends the back-edge drill to the far end of the room', () => {
    expect(fitToRoom(APP_DRILLS.find((d) => d.id === 'back-edge')!, 14).stations[0].d).toBe(14);
  });

  it('only offers drills that fit the surface and the room', () => {
    for (const z of ['tapin', 'short', 'mid', 'long', 'far', 'lag', 'deep'] as const) {
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

describe('deleting a putter', () => {
  it('moves its rounds to the putter you pick and buries the putter', () => {
    let s = { ...emptyState(), rounds: [round('old', 5, 2), round('new', 5, 2)] };
    s = reducer(s, { t: 'addPutter', id: 'old', name: 'Old' });
    s = reducer(s, { t: 'addPutter', id: 'new', name: 'New' });
    s = reducer(s, { t: 'deletePutter', id: 'old', moveTo: 'new' });
    expect(s.putters.map((p) => p.id)).toEqual(['new']);
    expect(s.rounds.every((r) => r.putterId === 'new')).toBe(true);
    expect(s.tombstones.some((t) => t.id === 'old' && t.kind === 'putter')).toBe(true);
    const back = reducer(s, {
      t: 'applyIncoming',
      incoming: { rounds: [], putters: [{ id: 'old', name: 'Old', active: false, retired: false, updated: '2000-01-01' }], removed: [] },
    });
    expect(back.putters.map((p) => p.id)).toEqual(['new']);
  });
});

describe('one hand at a time', () => {
  const st = (d: number, made: number, attempts: number, hand?: 'left' | 'right') => ({ d, mode: 'make' as const, made, attempts, ...(hand ? { hand } : {}) });
  const sets = [
    set('l', 'left-hand', 0, 0, '2026-11-02', { stations: [st(4, 18, 20, 'left'), st(6, 12, 20, 'left')] }),
    set('r', 'right-hand', 0, 0, '2026-11-03', { stations: [st(4, 10, 20, 'right'), st(6, 6, 20, 'right')] }),
    set('b', 'ten-4', 0, 0, '2026-11-03', { stations: [st(4, 19, 20), st(12, 5, 10)] }),
  ];
  it('lines the hands up at the distances a one-handed putt came from', () => {
    const { rows, total } = handsOf(sets, []);
    expect(rows.map((r) => r.d)).toEqual([4, 6]);
    expect([total.left.made, total.right.made, total.both.made]).toEqual([30, 16, 19]);
  });
  it('calls a better hand only past the noise', () => {
    expect(handGap({ made: 30, attempts: 40 }, { made: 16, attempts: 40 }).verdict).toBe('left');
    expect(handGap({ made: 21, attempts: 40 }, { made: 19, attempts: 40 }).verdict).toBe('even');
    expect(handGap({ made: 5, attempts: 10 }, { made: 1, attempts: 10 }).verdict).toBe('waiting');
  });
  it('waits for enough weeks before tying a hand to the course', () => {
    expect(handLink(sets, [], 'left')).toEqual({ weeks: 0, r: null });
  });
});

describe('pinpoint', () => {
  const tagged = (d: number, made: boolean, dirs: Putt['breakDirs'], extra: Partial<Putt> = {}): Putt => ({ d, made, breakDirs: dirs, ...extra });
  it('names the kind of putt behind a zone, against other tagged putts from there', () => {
    const r = round('a', 7, 1);
    r.holes = Array.from({ length: 36 }, (_, i) => {
      const lr = i % 2 === 0;
      const made = lr ? i % 6 === 0 : i % 4 !== 1;
      const p = tagged(7, made, [lr ? 'L→R' : 'R→L'], made ? {} : { missSide: lr ? 'low' : 'high' });
      return { hole: (i % 18) + 1, putts: made ? [p] : [p, { d: 1, made: true }] };
    });
    const [top] = pinpoint([r], B, 'mid');
    expect(top.cond).toBe('lr');
    expect(top.made).toBe(6);
    expect(top.lean?.lean).toBe('low');
    expect(fixFor(top.cond, top.lean!.lean, top.d, 'green')).toBe('fix:apex-lr:7');
    expect(fixFor(top.cond, top.lean!.lean, top.d, 'indoor')).toBe('fix:aim-lr:7');
  });
  it('builds a drill for every fix it can hand out', () => {
    for (const id of ['fix:gate:4', 'fix:past:6', 'fix:die:9', 'fix:apex-rl:8', 'fix:aim-lr:7', 'fix:firm-lr:7', 'fix:downhill:10', 'fix:uphill:8', 'fix:double:12']) {
      const d = fixDrill(id)!;
      expect(d.id).toBe(id);
      expect(d.stations[0].d).toBe(Number(id.split(':')[2]));
    }
    expect(fixDrill('fix:nonsense:4')).toBeUndefined();
  });
  it('finds a practice habit from the optional miss taps alone', () => {
    const misses = { left: 7, right: 2, short: 1 };
    const s1 = set('p1', 'ten-4', 10, 20, '2026-11-05', { stations: [{ d: 4, mode: 'make', made: 10, attempts: 20, misses }] });
    const p = practicePattern([s1])!;
    expect([p.dir, p.n, p.of, p.band]).toEqual(['left', 7, 10, '3 to 5 ft']);
    expect(practiceFix(p)).toBe('fix:gate:4');
  });
  it('stays quiet until the misses agree', () => {
    const s1 = set('p1', 'ten-4', 10, 20, '2026-11-05', { stations: [{ d: 4, mode: 'make', made: 10, attempts: 20, misses: { left: 3, right: 3, short: 3 } }] });
    expect(practicePattern([s1])).toBeNull();
  });
});

describe('practice rounds', () => {
  it('live in their own list and are logged like a round', () => {
    let s = reducer(emptyState(), { t: 'addPutter', id: 'p', name: 'P' });
    const r = { ...round('p', 5, 2), finished: false, holes: [{ hole: 1, putts: [] }], holeCount: 9, practice: { surface: 'indoor' as const } };
    s = reducer(s, { t: 'newRound', round: r });
    expect(s.rounds).toHaveLength(0);
    expect(s.practiceRounds).toHaveLength(1);
    s = reducer(s, { t: 'addPutt', putt: { d: 12, made: false } });
    s = reducer(s, { t: 'addPutt', putt: { d: 2, made: true } });
    expect(s.practiceRounds[0].holes[0].putts.map((p) => p.d)).toEqual([12, 2]);
    s = reducer(s, { t: 'finishRound' });
    expect(s.practiceRounds[0].finished).toBe(true);
    expect(s.rounds).toHaveLength(0);
    s = reducer(s, { t: 'deleteRound', id: r.id });
    expect(s.practiceRounds).toHaveLength(0);
    expect(s.tombstones.find((t) => t.id === r.id)?.kind).toBe('practice');
  });
});

describe('no suggestion a golfer would squint at', () => {
  const zones = ['tapin', 'short', 'mid', 'long', 'far', 'lag', 'deep'] as const;
  const leans = [null, 'start-line', 'short', 'long', 'high', 'low'] as const;
  const extra: DrillDef[] = [
    { ...APP_DRILLS[0], id: 's30', name: '30 in a row from 3', scoring: 'streak', stations: [{ d: 3, balls: 0 }], source: 'import' },
    { ...APP_DRILLS[0], id: 's20', name: '20 in a row from 3', scoring: 'streak', stations: [{ d: 3, balls: 0 }], source: 'import' },
    { ...APP_DRILLS[0], id: 'up', name: 'Speed', scoring: 'count', stations: [{ d: 15, balls: 3, mode: 'zone', label: 'Uphill' }], source: 'import' },
  ];
  const all = [...extra, ...APP_DRILLS];
  for (const surface of ['indoor', 'green'] as const) {
    for (const room of [12, 30, 60]) {
      it(`${surface} at ${room} ft`, () => {
        for (const z of zones) {
          for (const lean of leans) {
            const list = drillsFor(all, z, lean, surface, room);
            for (const d of list) {
              expect(d.stations.every((s) => !s.movedFrom || s.d / s.movedFrom >= 0.8)).toBe(true);
              expect(d.stations.some((s) => s.hand)).toBe(false);
              if (surface === 'indoor') expect(d.stations.some((s) => /uphill|downhill/i.test(s.label ?? ''))).toBe(false);
            }
            const streaks = list.filter((d) => d.scoring === 'streak').map((d) => Math.min(...d.stations.map((s) => s.d)));
            expect(new Set(streaks).size).toBe(streaks.length);
          }
        }
      });
    }
  }
  it('gives lag findings lag drills, never a gate from 30 feet', () => {
    for (const cond of ['lr', 'rl', 'double', 'straight', 'uphill', 'downhill', null] as const) {
      for (const lean of leans) {
        for (const surface of ['indoor', 'green'] as const) {
          const name = fixDrill(fixFor(cond, lean, 30, surface))!.name;
          expect(name).toMatch(/lag/i);
        }
      }
    }
    expect(fixDrill(fixFor(null, 'long', 4, 'indoor'))!.name).toBe('Dead weight from 4');
  });
});

describe('stroke and reads', () => {
  /** One round, a hole per putt, each missed putt followed by a tap-in. */
  const tagged = (putts: Putt[]): Round => {
    day++;
    return {
      id: `t${day}`, label: 't', date: '2026-10-01', putterId: 'a', holeCount: putts.length, finished: true,
      holes: putts.map((p, i) => ({ hole: i + 1, putts: p.made ? [p] : [p, { d: 1, made: true }] })),
    };
  };
  const many = (n: number, p: Putt) => Array.from({ length: n }, () => ({ ...p }));

  it('says nothing on a round with no tags', () => {
    expect(habitsOf([round('a', 6, 3)], 'indoor')).toEqual([]);
  });

  it('names an under-read on one side and hands back the read drill for it', () => {
    const lr: Putt = { d: 8, made: false, breakDirs: ['L→R'], readAs: 1, brokeAs: 2 };
    const right: Putt = { d: 8, made: true, breakDirs: ['L→R'], readAs: 2, brokeAs: 2 };
    const h = habitsOf([tagged([...many(9, lr), ...many(4, right)])], 'green');
    const read = h.find((x) => x.key === 'read')!;
    expect(read.title).toBe('You under-read left-to-right putts');
    expect(read.fix).toBe(fixFor('lr', 'low', 8, 'green'));
  });

  it('waits on a side with too few reads logged', () => {
    const lr: Putt = { d: 8, made: false, breakDirs: ['L→R'], readAs: 1, brokeAs: 2 };
    expect(habitsOf([tagged(many(11, lr))], 'green').find((x) => x.key === 'read')).toBeUndefined();
  });

  it('calls a push when the start-line misses lean one way', () => {
    const push: Putt = { d: 6, made: false, push: true };
    const pull: Putt = { d: 6, made: false, pull: true };
    const h = habitsOf([tagged([...many(7, push), pull])], 'indoor');
    expect(h.find((x) => x.key === 'start')?.title).toBe('When you miss your line, it is a push');
    expect(habitsOf([tagged([...many(5, push), ...many(3, pull)])], 'indoor').find((x) => x.key === 'start')).toBeUndefined();
  });

  it('says how many misses a push is out of, and stays quiet when it is a small part of them', () => {
    const push: Putt = { d: 6, made: false, push: true };
    const miss: Putt = { d: 6, made: false };
    const start = (extra: number) => habitsOf([tagged([...many(19, push), ...many(2, { d: 6, made: false, pull: true }), ...many(extra, miss)])], 'indoor').find((x) => x.key === 'start');
    expect(start(142)?.detail).toContain('19 pushes and 2 pulls in your 163 misses');
    expect(start(142)?.weight).toBeCloseTo(19 / 163);
    expect(start(200)).toBeUndefined();
  });

  it('ranks a habit by how much of the problem it is, not how lopsided', () => {
    const push: Putt = { d: 6, made: false, push: true };
    const under: Putt = { d: 8, made: false, breakDirs: ['L→R'], readAs: 1, brokeAs: 2 };
    const right: Putt = { d: 8, made: true, breakDirs: ['L→R'], readAs: 2, brokeAs: 2 };
    const h = habitsOf([tagged([...many(19, push), ...many(120, { d: 6, made: false }), ...many(11, under), ...many(8, right)])], 'indoor');
    expect(h.map((x) => x.key).slice(0, 2)).toEqual(['read', 'start']);
  });

  it('calls lips only when they are a real share of short misses', () => {
    const lip: Putt = { d: 5, made: false, lip: true };
    const miss: Putt = { d: 5, made: false };
    expect(habitsOf([tagged([...many(8, lip), ...many(12, miss)])], 'indoor').find((x) => x.key === 'lip')).toBeDefined();
    expect(habitsOf([tagged([...many(8, lip), ...many(40, miss)])], 'indoor').find((x) => x.key === 'lip')).toBeUndefined();
  });

  it('counts toe and heel as off the middle, centre never', () => {
    const toe: Putt = { d: 6, made: false, strike: 'toe' };
    const heel: Putt = { d: 6, made: false, strike: 'heel' };
    const centre: Putt = { d: 6, made: true, strike: 'centre' };
    const off = habitsOf([tagged([...many(4, toe), ...many(3, heel), ...many(8, centre)])], 'indoor');
    expect(off.find((x) => x.key === 'strike')?.fix).toBe('fix:strike:6');
    const fine = habitsOf([tagged([...many(3, toe), ...many(2, heel), ...many(31, centre)])], 'indoor');
    expect(fine.find((x) => x.key === 'strike')).toBeUndefined();
  });

  it('stays quiet on a few decels and a handful of holes after three-putts', () => {
    const decel: Putt = { d: 6, made: false, decel: true };
    const h = habitsOf([tagged(many(5, decel))], 'indoor');
    expect(h.find((x) => x.key === 'decel')).toBeUndefined();
    expect(h.find((x) => x.key === 'bleed')).toBeUndefined();
  });

  it('every habit drill resolves to something you can start', () => {
    const lr: Putt = { d: 8, made: false, breakDirs: ['L→R'], readAs: 1, brokeAs: 2, push: true, strike: 'toe', decel: true, lip: true };
    const h = habitsOf([tagged(many(20, lr))], 'indoor');
    expect(h.length).toBeGreaterThan(0);
    for (const x of h) expect(resolveDrill(emptyState(), x.fix), x.fix).toBeDefined();
  });
});

describe('pinpoint past 16 ft', () => {
  it('reads lag causes from every long putt together', () => {
    const long = (d: number, dir: 'downhill' | 'uphill') => {
      const r = round('a', d, 4);
      r.holes.forEach((h) => {
        h.putts[0].breakDirs = [dir];
        if (dir === 'downhill' && h.putts[1]) h.putts[1].d = 7;
      });
      return r;
    };
    const rounds = [...Array.from({ length: 4 }, () => long(22, 'downhill')), ...Array.from({ length: 4 }, () => long(45, 'uphill'))];
    expect(pinpoint(rounds, B, 'lag')).toEqual(pinpoint(rounds, B, 'far'));
    expect(pinpoint(rounds, B, 'deep')).toEqual(pinpoint(rounds, B, 'far'));
    expect(pinpoint(rounds, B, 'lag').length).toBeGreaterThan(0);
  });
});

describe('weekly test', () => {
  const mkTest = (date: string, made: number, room = 30, surface: 'indoor' | 'green' = 'indoor'): PracticeSet =>
    set(`w${date}${made}`, TEST_ID, made, 18, date, {
      surface,
      stations: testBalls(room).map((b) => ({ d: b.d, mode: b.mode ?? 'make', made: 0, attempts: 1 })),
    });

  it('is always eighteen balls, and a short room moves the long six in', () => {
    for (const room of [3, 8, 12, 16, 20, 30, 60]) {
      const balls = testBalls(room);
      expect(balls).toHaveLength(18);
      expect(Math.max(...balls.map((b) => b.d))).toBeLessThanOrEqual(room);
    }
    expect(testBalls(30).filter((b) => b.mode === 'zone').map((b) => b.d)).toEqual([20, 22, 24, 26, 28, 30]);
    expect(testBalls(60)).toEqual(testBalls(30));
  });

  it('keeps one order all week and changes it the next', () => {
    const order = (date: string) => testDrill(30, 'indoor', date).stations.map((x) => `${x.d}${x.mode ?? ''}`).join();
    expect(weekOf('2026-11-04')).toBe('2026-11-02');
    expect(order('2026-11-02')).toBe(order('2026-11-08'));
    expect(order('2026-11-09')).not.toBe(order('2026-11-02'));
    expect([...testDrill(30, 'indoor', '2026-11-09').stations].sort((a, b) => a.d - b.d)).toEqual(
      [...testBalls(30)].sort((a, b) => a.d - b.d),
    );
  });

  it('counts the first test of a week, and only compares the same eighteen putts', () => {
    const sets = [mkTest('2026-11-02', 10), mkTest('2026-11-03', 16), mkTest('2026-11-10', 12), mkTest('2026-11-11', 15, 12)];
    const t = testStatus(sets, 'indoor', 30, '2026-11-12');
    expect(t.thisWeek?.made).toBe(12);
    expect(t.weeks.map((x) => x.made)).toEqual([10, 12]);
    expect(t.best?.made).toBe(12);
    expect(testStatus(sets, 'green', 30, '2026-11-12').thisWeek).toBeNull();
    expect(setupOf(sets[0].stations!)).not.toBe(setupOf(sets[3].stations!));
  });

  it('resolves like any drill, without showing up as one to pick', () => {
    expect(resolveDrill(emptyState(), TEST_ID)?.name).toBe('Weekly test');
    expect(APP_DRILLS.some((d) => d.id === TEST_ID)).toBe(false);
  });
});

describe('your target', () => {
  const base = { zone: null, slice: null, habit: null, pattern: null, lastRound: null, today: '2026-12-01' };
  const pattern = { band: '3 to 5 ft', surface: 'indoor' as const, dir: 'left' as const, n: 7, of: 10, d: 4 };

  it('gives a player with nothing logged the weekly test', () => {
    expect(targetKind(base)).toBe('test');
  });

  it('leads with the rounds while they are recent, and with practice once they go stale', () => {
    const f = focusOf([round('a', 7, 6), round('a', 7, 6), round('a', 7, 6), round('a', 7, 6)], B, 'a');
    const zone = f.zones.find((z) => z.zone === f.worst)!;
    expect(targetKind({ ...base, zone, pattern, lastRound: '2026-11-20' })).toBe('zone');
    expect(targetKind({ ...base, zone, pattern, lastRound: '2026-10-01' })).toBe('practice');
    expect(targetKind({ ...base, zone, lastRound: '2026-10-01' })).toBe('zone');
  });
});

describe('practice review', () => {
  const t = (date: string, made: number): PracticeSet => set(`t${date}`, TEST_ID, made, 18, date);

  it('waits for six tests, then only calls a change bigger than a good or bad week', () => {
    expect(testTrend([t('2026-11-02', 10), t('2026-11-09', 14)])).toBeNull();
    const flat = testTrend(['02', '09', '16', '23', '30'].map((d, i) => t(`2026-11-${d}`, 11 + (i % 2))).concat(t('2026-12-07', 12)));
    expect(flat?.beyond).toBe(false);
    const up = testTrend([8, 8, 9, 15, 16, 16].map((m, i) => t(`2026-0${i + 1}-05`, m)));
    expect(up?.first).toBeCloseTo(25 / 3);
    expect(up?.beyond).toBe(true);
  });

  it('puts the same putt again and again against the weekly test and practice rounds, fair on distance', () => {
    const same = set('s', 'ten-4', 9, 10, '2026-11-01', { stations: [{ d: 4, mode: 'make', made: 9, attempts: 10 }] });
    const ladder = set('l', 'ladder-3-6', 4, 4, '2026-11-01', {
      stations: [3, 4, 5, 6].map((d) => ({ d, mode: 'make' as const, made: 1, attempts: 1 })),
    });
    const test = set('t', TEST_ID, 2, 4, '2026-11-01', {
      stations: [{ d: 8, mode: 'make', made: 1, attempts: 2 }, { d: 24, mode: 'zone', made: 1, attempts: 2 }],
    });
    const r = spotVsMixed([same, ladder, test], [], 'indoor', B);
    expect(r.same).toMatchObject({ made: 9, attempts: 10 });
    expect(r.mixed).toMatchObject({ made: 1, attempts: 2 });
    expect(r.mixed.scratch).toBeLessThan(r.same.scratch);
    expect(spotVsMixed([same], [], 'green', B).same.attempts).toBe(0);
  });

  it('shows a miss band only past its minimum', () => {
    const tagged = (n: number) =>
      set(`m${n}`, 'ten-4', 0, n, '2026-11-01', { stations: [{ d: 4, mode: 'make', made: 0, attempts: n, misses: { left: n - 2, right: 2 } }] });
    expect(missBands([tagged(7)], 'indoor')).toEqual([]);
    expect(missBands([tagged(10)], 'indoor')[0]).toMatchObject({ label: '3 to 5 ft', total: 10, dirs: { left: 8, right: 2 } });
  });

  it('counts finished in-a-row drills and the longest run', () => {
    const streak = (id: string, run: number, finished: boolean) => set(id, 'run-3', run, run + 1, '2026-11-01', { run, finished });
    const p = pressureOf([streak('a', 12, true), streak('b', 31, false), set('c', 'ten-4', 8, 10, '2026-11-01')], (id) => resolveDrill(emptyState(), id));
    expect(p.streaks).toBe(2);
    expect(p.best?.run).toBe(31);
  });
});

describe('numbers say how much they know', () => {
  it('earns two decimals with a full sample, and a rounded zero has no sign', () => {
    expect(signedFor(-0.634, sample(40, 30, 'putts'))).toBe('-0.63');
    expect(signedFor(-0.634, sample(23, 30, 'putts'))).toBe('-0.6');
    expect(signedFor(0.634, sample(23, 30, 'putts'))).toBe('+0.6');
    expect(signedFor(-0.04, sample(23, 30, 'putts'))).toBe('0.0');
    expect(signedFor(0.04, sample(23, 30, 'putts'))).toBe('0.0');
  });
});

describe('lag is judged by the circle it was rolled to', () => {
  const lagRound = () => {
    const r = round('a', 25, 99);
    r.holes.forEach((h) => {
      if (h.putts[1]) h.putts[1].d = 2.5;
    });
    return r;
  };

  it('keeps the circle on the result', () => {
    const st = tallyStations([
      { d: 25, mode: 'zone', zoneFt: 3, made: true },
      { d: 25, mode: 'zone', zoneFt: 3, made: false },
      { d: 25, mode: 'zone', zoneFt: 1, made: true },
      { d: 6, mode: 'make', zoneFt: 3, made: true },
    ]);
    expect(st.map((s) => [s.d, s.zoneFt, s.attempts])).toEqual([[25, 3, 2], [25, 1, 1], [6, undefined, 1]]);
  });

  it('compares each circle with the same circle on the course, and never merges two', () => {
    const rounds = [lagRound(), lagRound()];
    const sets = [
      set('a', 'x', 7, 10, '2026-11-01', { stations: [{ d: 25, mode: 'zone', zoneFt: 3, made: 7, attempts: 10 }] }),
      set('b', 'y', 2, 10, '2026-11-01', { stations: [{ d: 25, mode: 'zone', zoneFt: 1, made: 2, attempts: 10 }] }),
    ];
    const reads = practiceVsPlay(sets, rounds);
    expect(reads.map((r) => r.zoneFt)).toEqual([1, 3]);
    // Every miss finishes 2.5 ft away: outside a 1 ft circle, inside a 3 ft one. Only the holed ones count at 1 ft.
    expect(reads[0].play).toEqual({ made: 2, attempts: 36 });
    expect(reads[1].play).toEqual({ made: 36, attempts: 36 });
  });
});

describe('a session left running', () => {
  const at = Date.parse('2026-11-01T12:00:00Z');
  const run = { session: 's', surface: 'indoor' as const, startedAt: '2026-11-01T12:00:00Z', block: 0, blockStartedAt: '2026-11-01T12:00:00Z', done: {} };
  const mins = (n: number) => at + n * 60_000;

  it('ends after ninety minutes with nothing logged, counted from the last thing logged', () => {
    expect(runLapsed(run, mins(89))).toBe(false);
    expect(runLapsed(run, mins(90))).toBe(true);
    expect(runLapsed({ ...run, lastLogged: '2026-11-01T13:00:00Z' }, mins(120))).toBe(false);
    expect(runLapsed({ ...run, lastLogged: '2026-11-01T13:00:00Z' }, mins(150))).toBe(true);
  });

  it('counts rolling a finished block again as logging, and ending keeps the drills', () => {
    let s = { ...emptyState(), run, practice: [set('a', 'ten-4', 8, 10, '2026-11-01')] };
    s = { ...s, run: { ...run, done: { 0: 'a' } } };
    const again = reducer(s, { t: 'finishBlock', block: 0, setId: 'a' });
    expect(again.run?.lastLogged).toBeDefined();
    const ended = reducer(again, { t: 'endRun' });
    expect(ended.run).toBeUndefined();
    expect(ended.practice).toHaveLength(1);
  });
});

describe('back link', () => {
  const walk = (...routes: string[]) => routes.reduce<string[]>(nextTrail, []);

  it('goes to where you came from, not always the tab', () => {
    expect(walk('/practice', '/practice/sessions', '/practice/session/a')).toEqual(['/practice', '/practice/sessions', '/practice/session/a']);
    expect(walk('/stats/practice', '/practice/drill/x').at(-2)).toBe('/stats/practice');
  });

  it('never points back into a form you just saved', () => {
    expect(walk('/practice', '/practice/session/a', '/practice/session-edit/a', '/practice/session/a')).toEqual(['/practice', '/practice/session/a']);
    expect(walk('/practice', '/practice/drill/x', '/practice/edit/x', '/practice/drill/x').at(-2)).toBe('/practice');
  });

  it('drops what came after a page you return to, and a tab starts over', () => {
    expect(walk('/practice', '/practice/sessions', '/practice/session/a', '/practice/sessions')).toEqual(['/practice', '/practice/sessions']);
    expect(walk('/practice', '/practice/sessions', '/settings', '/practice')).toEqual(['/practice']);
  });

  it('names the page it goes to', () => {
    expect(backLabel('/practice/sessions')).toBe('Sessions');
    expect(backLabel('/stats/practice')).toBe('Stats');
    expect(backLabel('/practice/session/a')).toBe('Session');
  });
});

describe('did it carry over', () => {
  const dated = (date: string, makeEvery: number, extra: Partial<Round> = {}) => ({ ...round('a', 7, makeEvery, extra), date });
  const rolled = (id: string, drill: string, date: string, d: number) =>
    set(id, drill, 5, 10, date, { stations: [{ d, mode: 'make', made: 5, attempts: 10 }] });

  it('splits a distance on the day you first practiced it, with no save step', () => {
    const rounds = [dated('2026-10-01', 4), dated('2026-12-01', 2)];
    const [row] = carryRows(rounds, [rolled('a', 'ten-6', '2026-11-01', 6), rolled('b', 'ten-6', '2026-11-20', 6)]);
    expect(row).toMatchObject({ zone: 'mid', cond: null, started: '2026-11-01', label: '6 to 8 ft' });
    expect(row.before).toEqual({ made: 5, attempts: 18 });
    expect(row.since).toEqual({ made: 9, attempts: 18 });
  });

  it('does not count the weekly test or one-handed work as starting on something', () => {
    const test = set('t', TEST_ID, 5, 18, '2026-11-01', { stations: [{ d: 6, mode: 'make', made: 5, attempts: 18 }] });
    const hand = set('h', 'left-hand', 5, 10, '2026-11-01', { stations: [{ d: 6, mode: 'make', hand: 'left', made: 5, attempts: 10 }] });
    expect(carryRows([], [test, hand])).toEqual([]);
  });

  it('keeps one start through a surface switch and tracks the kind of putt', () => {
    const sets = [rolled('a', 'fix:aim-lr:8', '2026-11-01', 8), { ...rolled('b', 'fix:apex-lr:7', '2026-11-05', 7), surface: 'green' as const }];
    const row = carryRows([], sets).find((c) => c.cond === 'lr')!;
    expect(row.started).toBe('2026-11-01');
    expect(row.label).toBe('Breaking left to right, 6 to 8 ft');
  });

  it('says more to compare, then only calls a change past chance', () => {
    const base = { started: '2026-11-01', before: { made: 8, attempts: 23 } };
    expect(carryText({ ...base, since: { made: 1, attempts: 3 } })).toContain('3 of these on the course, 7 more to compare');
    expect(carryText({ ...base, since: { made: 5, attempts: 12 } })).toContain('Within what chance can do');
    expect(carryText({ ...base, since: { made: 28, attempts: 30 } })).toContain('Up by more than chance');
    expect(carryText({ ...base, since: { made: 1, attempts: 30 } })).toContain('Down by more than chance');
  });
});

describe('what a round showed', () => {
  const tagged = (date: string, putts: Putt[]): Round => ({
    id: `p${date}`, label: 'p', date, putterId: 'a', holeCount: putts.length, finished: true,
    holes: putts.map((p, i) => ({ hole: i + 1, putts: p.made ? [p] : [p, { d: 1, made: true }] })),
  });
  const many = (n: number, p: Putt) => Array.from({ length: n }, () => ({ ...p }));

  it('counts this round alone, biggest first', () => {
    const t = roundTags(tagged('2026-11-01', [...many(3, { d: 6, made: false, push: true }), { d: 5, made: false, lip: true }, { d: 3, made: true }]));
    expect(t).toMatchObject({ tagged: 4, putts: 9 });
    expect(t.lines).toEqual(['Start line: 3 pushed, 0 pulled.', '1 lipped out.']);
  });

  it('calls a finding new only on the round that took it past its minimum', () => {
    const push: Putt = { d: 6, made: false, push: true };
    const first = tagged('2026-11-01', many(6, push));
    const second = tagged('2026-11-08', many(2, push));
    const third = tagged('2026-11-15', many(2, push));
    const rounds = [first, second, third];
    expect(roundPayoff(first, rounds, [], 'indoor').found).toEqual([]);
    expect(roundPayoff(second, rounds, [], 'indoor').found.map((h) => h.title)).toEqual(['When you miss your line, it is a push']);
    expect(roundPayoff(third, rounds, [], 'indoor').found).toEqual([]);
    expect(roundPayoff(third, rounds, [], 'indoor').still?.title).toBe('When you miss your line, it is a push');
    expect(roundPayoff(third, rounds, [], 'indoor').still).toMatchObject({ round: '2 pushed, 0 pulled', total: '10 pushes and 0 pulls in 10 misses' });
    expect(roundPayoff(third, rounds, [], 'indoor').lines).toEqual([]);
    expect(roundPayoff(tagged('2026-11-20', [{ d: 6, made: false, lip: true }]), [...rounds], [], 'indoor').still).toBeNull();
  });

  it('shows practice work only on rounds after it started, and leaves another putter out', () => {
    const r = tagged('2026-11-08', [{ d: 7, made: true }, { d: 7, made: false }]);
    const old = tagged('2026-10-01', [{ d: 7, made: true }]);
    const carry = carryRows([old, r], [set('a', 'ten-6', 5, 10, '2026-11-01', { stations: [{ d: 6, mode: 'make', made: 5, attempts: 10 }] })]);
    expect(roundPayoff(r, [old, r], carry, 'indoor').work[0]).toMatchObject({ label: '6 to 8 ft', made: 1, attempts: 2 });
    expect(roundPayoff(old, [old, r], carry, 'indoor').work).toEqual([]);
    expect(roundPayoff(r, [old], carry, 'indoor').work).toEqual([]);
  });
});
