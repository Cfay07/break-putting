import { describe, expect, it } from 'vitest';
import { dedupeCourses, sameCourse } from './courses';

describe('course names', () => {
  it('matches the course by name', () => {
    expect(sameCourse('Ives Grove', 'Ives Grove Golf Links')).toBe(true);
    expect(sameCourse('Blue Spruce-Brighton Dale Links', 'Brighton Dale Links · Blue Spruce 18')).toBe(true);
    expect(sameCourse('White Birch-Brighton Dale Links', 'Brighton Dale Links · Blue Spruce 18')).toBe(false);
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
