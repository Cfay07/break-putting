import { describe, expect, it } from 'vitest';
import { BOARDS, board, seasonStart, windowRange } from './board';
import type { TeamRound } from './teams';

const now = Date.parse('2026-11-16T18:00:00Z');
const def = (k: string) => BOARDS.find((b) => b.key === k)!;

function round(user: string, played_on: string, sg: number, over: Partial<TeamRound> = {}): TeamRound {
  return {
    user_id: user,
    round_id: `${user}-${played_on}`,
    played_on,
    course: 'Here',
    holes_played: 18,
    score: 75,
    putts: 30,
    three_putts: 1,
    sg,
    competitive: false,
    detail: [],
    ...over,
  };
}

describe('windows', () => {
  it('starts the season on August 1, so January belongs to the fall before', () => {
    expect(seasonStart(Date.parse('2027-01-10T12:00:00Z'))).toBe('2026-08-01');
    expect(seasonStart(now)).toBe('2026-08-01');
  });
  it('compares a week with the week before it', () => {
    expect(windowRange('week', now)).toEqual({ from: '2026-11-09', prevFrom: '2026-11-02' });
  });
});

describe('board', () => {
  it('ranks by the window and leaves out rounds outside it', () => {
    const rows = board(def('sg'), ['a', 'b'], [round('a', '2026-11-12', 1), round('b', '2026-11-12', 2), round('a', '2026-10-01', 9)], [], 'week', false, now);
    expect(rows.map((r) => [r.user, r.place])).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });

  it('puts the lowest first when lower is better, and shares a place on a tie', () => {
    const rows = board(
      def('putts'),
      ['a', 'b', 'c'],
      [round('a', '2026-11-12', 0, { putts: 30 }), round('b', '2026-11-12', 0, { putts: 30 }), round('c', '2026-11-12', 0, { putts: 33 })],
      [],
      'week',
      false,
      now,
    );
    expect(rows.map((r) => r.place)).toEqual([1, 1, 3]);
  });

  it('counts places moved since the window before', () => {
    const rounds = [
      round('a', '2026-11-05', 3),
      round('b', '2026-11-05', 1),
      round('a', '2026-11-12', 0),
      round('b', '2026-11-12', 2),
    ];
    const rows = board(def('sg'), ['a', 'b'], rounds, [], 'week', false, now);
    expect(rows.find((r) => r.user === 'b')!.moved).toBe(1);
    expect(rows.find((r) => r.user === 'a')!.moved).toBe(-1);
  });

  it('keeps a player with too little at the bottom, unranked', () => {
    const rows = board(def('sg'), ['a', 'b'], [round('a', '2026-11-12', 1), round('b', '2026-11-12', 5, { holes_played: 6 })], [], 'week', false, now);
    expect(rows[1]).toMatchObject({ user: 'b', place: null, value: null });
  });

  it('can rank tournament rounds only', () => {
    const rounds = [round('a', '2026-11-12', 1, { competitive: true }), round('b', '2026-11-12', 4)];
    const rows = board(def('sg'), ['a', 'b'], rounds, [], 'week', true, now);
    expect(rows[0].user).toBe('a');
    expect(rows[1].place).toBeNull();
  });

  it('ranks practice volume and the best weekly test', () => {
    const practice = [
      { user_id: 'a', set_id: '1', played_on: '2026-11-12', title: 'Gate', kind: 'set' as const, made: 5, attempts: 20 },
      { user_id: 'b', set_id: '2', played_on: '2026-11-12', title: 'Test', kind: 'test' as const, made: 13, attempts: 18 },
    ];
    expect(board(def('work'), ['a', 'b'], [], practice, 'week', false, now)[0]).toMatchObject({ user: 'a', value: { v: 20 } });
    expect(board(def('test'), ['a', 'b'], [], practice, 'week', false, now)[0]).toMatchObject({ user: 'b', value: { v: 13 } });
  });
});
