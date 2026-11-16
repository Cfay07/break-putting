import { describe, expect, it } from 'vitest';
import { playerWeeks, teamLeak } from './coach';
import type { TeamPracticeRow } from './feed';
import { DEFAULT_BASELINE } from './types';
import type { PlayerStats, TeamRound } from './teams';

const A = 'a';
const B = 'b';

/** Eighteen holes: two-putts from 25 feet, and one missed-then-holed putt from each given length. */
function round(user: string, id: string, played_on: string, misses: number[], sg = 0): TeamRound {
  const detail = Array.from({ length: 18 }, (_, i) => ({ h: i + 1, p: 2, d: 25, v: 0 }));
  misses.forEach((d, i) => (detail[i] = { h: i + 1, p: 2, d, v: 1 }));
  return {
    user_id: user,
    round_id: id,
    played_on,
    course: null,
    holes_played: 18,
    score: 75,
    putts: 36,
    three_putts: 0,
    sg,
    competitive: false,
    detail,
  };
}

function stats(user: string, sg_pr: number | null): PlayerStats {
  return {
    user_id: user,
    rounds: 10,
    competitive_rounds: 0,
    putts_pr: null,
    three_pr: null,
    sg_pr,
    make6: null,
    bleed_pr: null,
    bounce_back: null,
    scoring_pct: null,
    last_round: null,
    live: null,
  };
}

describe('teamLeak', () => {
  it('needs two rounds of holes before it says anything', () => {
    expect(teamLeak([round(A, '1', '2026-10-01', [7])], [A], DEFAULT_BASELINE)).toBeNull();
  });

  it('finds the band losing the most per 18, and who shares it', () => {
    const rounds = [
      round(A, '1', '2026-10-01', [7, 8, 6, 9]),
      round(A, '2', '2026-10-03', [7, 8, 6]),
      round(B, '3', '2026-10-02', [7, 8, 9]),
      round(B, '4', '2026-10-04', [4, 4, 4, 4]),
    ];
    const leak = teamLeak(rounds, [A, B], DEFAULT_BASELINE)!;
    expect(leak.worst.key).toBe('mid');
    expect(leak.worst.per18).toBeLessThan(0);
    expect(leak.rounds).toBe(4);
    expect(leak.players).toBe(2);
    expect(leak.sharing).toBe(1);
  });

  it('leaves out anyone not on the player list, like a coach', () => {
    const rounds = [round(A, '1', '2026-10-01', [7]), round(B, '2', '2026-10-01', [7])];
    expect(teamLeak(rounds, [A], DEFAULT_BASELINE)).toBeNull();
  });
});

describe('playerWeeks', () => {
  const now = Date.parse('2026-11-16T18:00:00Z');
  const set = (over: Partial<TeamPracticeRow>): TeamPracticeRow => ({
    user_id: A,
    set_id: Math.random().toString(),
    played_on: '2026-11-14',
    title: 'Gate',
    kind: 'set',
    made: 7,
    attempts: 10,
    ...over,
  });

  it('counts the last seven days and the newest test', () => {
    const [w] = playerWeeks(
      [A],
      [round(A, '1', '2026-11-12', [])],
      [
        set({}),
        set({ played_on: '2026-11-01' }),
        set({ kind: 'test', made: 12, attempts: 18, played_on: '2026-11-02' }),
      ],
      [],
      null,
      now,
    );
    expect(w).toMatchObject({ rounds: 1, sets: 1, putts: 10, test: { made: 12, attempts: 18 }, quiet: 2 });
  });

  it('says how long a player has been quiet, and null when they never logged', () => {
    const weeks = playerWeeks([A, B], [round(A, '1', '2026-11-01', [])], [], [], null, now);
    expect(weeks[0].quiet).toBe(15);
    expect(weeks[1].quiet).toBeNull();
  });

  it('marks the week done only for the coach pick, rolled after it was set', () => {
    const focus = { session: 'focus-mid', set_at: '2026-11-13T09:00:00Z' };
    const [early, done] = playerWeeks(
      [A, B],
      [],
      [set({ session: 'focus-mid', played_on: '2026-11-10' }), set({ user_id: B, session: 'focus-mid' })],
      [],
      focus,
      now,
    );
    expect(early.didFocus).toBe(false);
    expect(done.didFocus).toBe(true);
  });

  it('trends the last 30 days against the season, per 18', () => {
    const [w] = playerWeeks(
      [A],
      [round(A, '1', '2026-11-01', [], 1), round(A, '2', '2026-11-05', [], 2)],
      [],
      [stats(A, 0.5)],
      null,
      now,
    );
    expect(w.trend).toBeCloseTo(1);
  });
});
