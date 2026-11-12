import { describe, expect, it } from 'vitest';
import { fillFrom } from './openGolf';

describe('filling ratings from the open data', () => {
  it('fills only missing tees, men first, then nearest yardage', () => {
    const tees = [
      { name: 'White', yards: 6386, pars: [], rating: 70.8, slope: 124 },
      { name: 'Red', yards: 5119, pars: [] },
      { name: 'Yellow', yards: 5391, pars: [] },
    ];
    const out = fillFrom(tees, [
      { tee_name: 'White', gender: 'Male', course_rating: 70.2, slope: 122, yardage: 6449 },
      { tee_name: 'Red', gender: 'Female', course_rating: 70.0, slope: 118, yardage: 5119 },
      { tee_name: 'Red', gender: 'Male', course_rating: 72.4, slope: 123, yardage: 5583 },
    ]);
    expect(out[0]).toBe(tees[0]);
    expect(out[1]).toMatchObject({ rating: 72.4, slope: 123 });
    expect(out[2]).toBe(tees[2]);
  });
});
