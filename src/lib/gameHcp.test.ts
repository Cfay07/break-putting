import { describe, expect, it } from 'vitest';
import { dedupeCourses, gameHcp, ratingGaps, sameCourse } from './gameHcp';
import { hcpText } from './puttingHcp';
import type { Round, SavedCourse } from './types';

const course: SavedCourse = {
  id: 'c',
  name: 'Test',
  tees: [{ name: 'Blue', pars: Array(18).fill(4), rating: 72, slope: 113 }],
};

const rnd = (d: string, score: number, holes = 18, tee = 'Blue') =>
  ({
    id: d, label: d, date: d, putterId: 'p', holeCount: holes, finished: true, courseId: 'c', tee,
    holes: Array.from({ length: holes }, (_, i) => ({ hole: i + 1, par: 4, strokes: i === 0 ? 4 + score - holes * 4 : 4, putts: [] })),
  }) as unknown as Round;

const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);

describe('handicap from scores', () => {
  it('is score minus rating on a 113 slope', () => {
    expect(hcpText(gameHcp(days(5).map((d) => rnd(d, 75)), [course])!.hcp)).toBe('3.0');
  });

  it('scales by slope', () => {
    const steep = { ...course, tees: [{ ...course.tees[0], slope: 140 }] };
    expect(gameHcp(days(5).map((d) => rnd(d, 82)), [steep])!.hcp).toBeCloseTo((113 / 140) * 10);
  });

  it('pairs two nines against half the rating each', () => {
    const rounds = [...days(4).map((d) => rnd(d, 75)), rnd('2026-10-10', 37, 9), rnd('2026-10-11', 38, 9)];
    const g = gameHcp(rounds, [course])!;
    expect(g.rounds[0]).toMatchObject({ nines: true });
    expect(g.rounds[0].hcp).toBeCloseTo(3);
  });

  it('leaves out rounds with no rated tee and counts them', () => {
    const rounds = [...days(5).map((d) => rnd(d, 75)), rnd('2026-10-20', 70, 18, 'Gold')];
    expect(gameHcp(rounds, [course])!.rounds).toHaveLength(5);
    expect(ratingGaps(rounds, [course]).unrated).toBe(1);
  });
});

describe('imported rounds with only a course name', () => {
  const named = (d: string, score: number, extra: Partial<Round>) => ({ ...rnd(d, score), courseId: undefined, tee: undefined, ...extra }) as Round;

  it('matches the course by name', () => {
    expect(sameCourse('Ives Grove', 'Ives Grove Golf Links')).toBe(true);
    expect(sameCourse('Blue Spruce-Brighton Dale Links', 'Brighton Dale Links · Blue Spruce 18')).toBe(true);
    expect(sameCourse('White Birch-Brighton Dale Links', 'Brighton Dale Links · Blue Spruce 18')).toBe(false);
  });

  it('uses the nines when the round has them, and your usual yardage when it does not', () => {
    const two = {
      ...course,
      name: 'Test Golf Club',
      tees: [
        { name: 'Blue', yards: 6900, pars: Array(18).fill(4), rating: 73, slope: 130 },
        { name: 'White', yards: 6300, pars: Array(18).fill(4), rating: 70, slope: 120 },
      ],
    };
    const rounds = [
      ...days(5).map((d) => ({ ...rnd(d, 75), tee: 'Blue' }) as Round),
      named('2026-10-20', 80, { course: 'Test Golf Club' }),
    ];
    const gaps = ratingGaps(rounds, [two]);
    expect(gaps).toEqual({ unrated: 0, guessed: 1 });
    expect(gameHcp(rounds, [two])!.rounds).toHaveLength(6);
  });
});

describe('one entry per course', () => {
  it('collapses copies of a course to the best-rated one, but keeps same-named courses in different towns', () => {
    const blank = { id: 'saved', name: 'Shiloh Park Golf Course', place: 'Zion, IL', tees: [] };
    const rated = { id: 'builtin', name: 'Shiloh Park Golf Course', place: 'Zion, IL', tees: [{ name: 'Blue', pars: [], rating: 33.8, slope: 122 }] };
    const other = { id: 'woodstock', name: 'Shiloh Park Golf Course', place: 'Woodstock, IL', tees: [] };
    expect(dedupeCourses([blank, rated, other]).map((c) => c.id)).toEqual(['builtin', 'woodstock']);
  });
});
