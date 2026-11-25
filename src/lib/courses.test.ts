import { describe, expect, it } from 'vitest';
import { dedupeCourses, dedupeHits, sameCourse } from './courses';

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
    const rated = {
      id: 'builtin',
      name: 'Shiloh Park Golf Course',
      place: 'Zion, IL',
      tees: [{ name: 'Blue', pars: [], rating: 33.8, slope: 122 }],
    };
    const other = { id: 'woodstock', name: 'Shiloh Park Golf Course', place: 'Woodstock, IL', tees: [] };
    expect(dedupeCourses([blank, rated, other]).map((c) => c.id)).toEqual(['builtin', 'woodstock']);
  });
});

describe('search rows', () => {
  const row = (id: string, name: string, place?: string) => ({ id, name, place });
  it('shows a course the service lists under its own id only once', () => {
    const hits = dedupeHits([
      row('builtin-shiloh-park', 'Shiloh Park Golf Course', 'Zion, IL'),
      row('cn9ke73z', 'Shiloh Park Golf Course', 'Zion, IL'),
      row('builtin-vernon-hills', 'Vernon Hills Muni', 'Vernon Hills, IL'),
      row('x1', 'Vernon Hills Golf Course', 'Vernon Hills, IL'),
    ]);
    expect(hits.map((h) => h.id)).toEqual(['builtin-shiloh-park', 'builtin-vernon-hills']);
  });

  it('keeps courses that share a name in different towns, and different courses at one club', () => {
    const hits = dedupeHits([
      row('a', 'Vernon Hills Muni', 'Vernon Hills, IL'),
      row('b', 'Vernon Hills Golf Club', 'Peshtigo, WI'),
      row('c', 'Brighton Dale Links · Blue Spruce 18', 'Kansasville, WI'),
      row('d', 'Brighton Dale Links · Red Pine 9', 'Kansasville, WI'),
      row('e', 'Brighton Dale Links · White Birch 18', 'Kansasville, WI'),
    ]);
    expect(hits).toHaveLength(5);
  });

  it('shows a typed course with no town once, as the copy that has the town', () => {
    const hits = dedupeHits([row('t', 'Blackstone'), row('s', 'Blackstone Golf Club', 'Marengo, IL')]);
    expect(hits.map((h) => h.id)).toEqual(['s']);
  });

  it('keeps a bare typed name apart from a longer name it is only part of', () => {
    expect(dedupeHits([row('t', 'Shiloh'), row('s', 'Shiloh Park Golf Course', 'Zion, IL')])).toHaveLength(2);
  });
});
