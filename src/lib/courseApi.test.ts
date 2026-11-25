import { describe, expect, it } from 'vitest';
import { asStraightNine } from './courseApi';

const nine = [
  { par: 4, yardage: 360 },
  { par: 5, yardage: 511 },
  { par: 4, yardage: 372 },
  { par: 3, yardage: 182 },
  { par: 5, yardage: 538 },
  { par: 4, yardage: 453 },
  { par: 4, yardage: 425 },
  { par: 4, yardage: 443 },
  { par: 3, yardage: 192 },
];

describe('a nine listed as eighteen', () => {
  it('saves Red Pine 9 as the nine it is, rated for nine', () => {
    const tee = { holes: [...nine, ...nine], course_rating: 72.8, slope_rating: 129, front_course_rating: 36.4 };
    expect(asStraightNine(tee)).toEqual({
      pars: [4, 5, 4, 3, 5, 4, 4, 4, 3],
      yards: 3476,
      rating: 36.4,
      slope: 129,
    });
  });

  it('leaves a real eighteen alone, even with the same pars both ways', () => {
    const back = nine.map((h) => ({ ...h, yardage: h.yardage + 10 }));
    expect(asStraightNine({ holes: [...nine, ...back] })).toBeNull();
  });
});
