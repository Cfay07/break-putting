import { describe, expect, it } from 'vitest';
import { buildFeed, liveNow, reactionsFor, type TeamPracticeRow } from './feed';
import type { PlayerStats, TeamRound } from './teams';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const names = new Map([
  [A, 'You'],
  [B, 'Sam'],
]);

function round(over: Partial<TeamRound> = {}): TeamRound {
  return {
    user_id: B,
    round_id: 'r1',
    played_on: '2026-11-10',
    course: 'Strawberry Creek',
    holes_played: 18,
    score: 74,
    putts: 30,
    three_putts: 1,
    sg: 0.8,
    competitive: false,
    detail: [],
    ...over,
  };
}

function set(over: Partial<TeamPracticeRow> = {}): TeamPracticeRow {
  return {
    user_id: A,
    set_id: 's1',
    played_on: '2026-11-12',
    title: 'Gate drill',
    kind: 'set',
    made: 8,
    attempts: 10,
    ...over,
  };
}

function stats(over: Partial<PlayerStats> = {}): PlayerStats {
  return {
    user_id: B,
    rounds: 3,
    competitive_rounds: 0,
    putts_pr: null,
    three_pr: null,
    sg_pr: null,
    make6: null,
    bleed_pr: null,
    bounce_back: null,
    scoring_pct: null,
    last_round: null,
    live: null,
    ...over,
  };
}

describe('buildFeed', () => {
  it('makes one post per round, headlined with the score and course', () => {
    const [p] = buildFeed([round()], [], names);
    expect(p.kind).toBe('round');
    expect(p.headline).toBe('Sam shot 74 at Strawberry Creek');
    expect(p.key).toBe(`round:${B}:r1`);
  });

  it('says holes logged when there is no score', () => {
    const [p] = buildFeed([round({ score: null, holes_played: 6 })], [], names);
    expect(p.headline).toBe('Sam logged 6 holes at Strawberry Creek');
  });

  it('picks the longest holed putt as the highlight', () => {
    const [p] = buildFeed(
      [
        round({
          detail: [
            { h: 3, p: 1, d: 18, v: 0 },
            { h: 7, p: 1, d: 32, v: -1 },
            { h: 9, p: 2, d: 40, v: 0 },
          ],
        }),
      ],
      [],
      names,
    );
    expect(p.kind === 'round' && p.highlight).toBe('Holed a 32-footer on 7.');
    expect(p.kind === 'round' && p.hot).toBe(true);
  });

  it('falls back to no three-putts, and says nothing about an ordinary round', () => {
    const [clean] = buildFeed([round({ three_putts: 0 })], [], names);
    const [plain] = buildFeed([round()], [], names);
    expect(clean.kind === 'round' && clean.highlight).toBe('No three-putts.');
    expect(clean.kind === 'round' && clean.hot).toBe(false);
    expect(plain.kind === 'round' && plain.highlight).toBeNull();
  });

  it('rolls a day of practice into one post per player', () => {
    const posts = buildFeed(
      [],
      [set(), set({ set_id: 's2', title: 'Ladder' }), set({ set_id: 's3', kind: 'test', made: 11, attempts: 18 })],
      names,
    );
    expect(posts).toHaveLength(1);
    const p = posts[0];
    expect(p.headline).toBe('You took the weekly test');
    expect(p.kind === 'practice' && p.test).toEqual({ made: 11, attempts: 18 });
    expect(p.kind === 'practice' && p.sets.map((s) => s.title)).toEqual(['Gate drill', 'Ladder']);
  });

  it('puts the newest first, and a round ahead of practice on the same day', () => {
    const posts = buildFeed(
      [round({ played_on: '2026-11-12' })],
      [set(), set({ set_id: 'old', played_on: '2026-11-01' })],
      names,
    );
    expect(posts.map((p) => `${p.kind}:${p.date}`)).toEqual([
      'round:2026-11-12',
      'practice:2026-11-12',
      'practice:2026-11-01',
    ]);
  });
});

describe('liveNow', () => {
  const now = Date.parse('2026-11-16T15:00:00Z');
  it('shows a teammate logging in the last three hours', () => {
    const live = liveNow(
      [stats({ live: { hole: 7, thru: 6, course: 'Bristol Oaks', started_at: '2026-11-16T14:30:00Z' } })],
      [B],
      now,
    );
    expect(live).toEqual([{ user: B, hole: 7, thru: 6, course: 'Bristol Oaks' }]);
  });

  it('drops a round abandoned hours ago, and anyone not on the team', () => {
    const stale = stats({ live: { hole: 9, thru: 9, started_at: '2026-11-16T09:00:00Z' } });
    const stranger = stats({ user_id: 'x', live: { hole: 2, thru: 2, started_at: '2026-11-16T14:50:00Z' } });
    expect(liveNow([stale, stranger], [B], now)).toEqual([]);
  });
});

describe('reactionsFor', () => {
  it('counts taps on one post and knows if one is yours', () => {
    const r = [
      { post: 'p1', user_id: A },
      { post: 'p1', user_id: B },
      { post: 'p2', user_id: B },
    ];
    expect(reactionsFor('p1', r, A)).toEqual({ count: 2, mine: true });
    expect(reactionsFor('p2', r, A)).toEqual({ count: 1, mine: false });
  });
});
