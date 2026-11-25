import { describe, expect, it } from 'vitest';
import { teesFor } from '../components/CoursePicker';
import { BUILT_IN_COURSES } from './builtInCourses';
import { teeOf } from './courses';
import type { Round, SavedCourse } from './types';

const ives = BUILT_IN_COURSES.find((c) => c.id === 'builtin-ives-grove')!;
const round = (tee: string) => ({ courseId: 'builtin-ives-grove', tee }) as Round;

describe('Ives Grove tees', () => {
  it('has every tee box on every ordering of the nines', () => {
    expect(ives.tees).toHaveLength(30);
    const gold = ives.tees.find((t) => t.name === 'Blue/Red · Gold')!;
    expect(gold).toMatchObject({ yards: 5950, rating: 68.1, slope: 119 });
    expect(ives.tees.find((t) => t.name === 'White/Red · White')).toMatchObject({ yards: 6450, rating: 70.5 });
  });

  it('labels the women-only rating so it never reads as a men’s', () => {
    expect(ives.tees.some((t) => t.name === 'Red/White · Red')).toBe(false);
    expect(ives.tees.find((t) => t.name === 'Red/White · Red (W)')).toMatchObject({ rating: 70.4, slope: 121 });
  });

  it('keeps old rounds saved as plain "Red/White" on the Blue box they were rated off', () => {
    expect(teeOf(round('Red/White'), [])).toMatchObject({ name: 'Red/White · Blue', rating: 72.8, slope: 130 });
    expect(teeOf(round('White/Blue'), [])).toMatchObject({ rating: 73.0, slope: 131 });
  });
});

describe('tees offered for the round', () => {
  const pv: SavedCourse = {
    id: 'pv',
    name: 'Pleasant View · Lake / Woods',
    tees: [
      { name: 'Goat (L/W)', pars: Array(18).fill(4) },
      { name: 'Goat (L9)', pars: Array(9).fill(4) },
    ],
  };
  it('never stretches a nine-hole tee over eighteen when eighteen-hole tees exist', () => {
    expect(teesFor(pv, 18).map((t) => t.name)).toEqual(['Goat (L/W)']);
  });
  it('offers the nine-hole tee first for a nine', () => {
    expect(teesFor(pv, 9).map((t) => t.name)).toEqual(['Goat (L9)', 'Goat (L/W)']);
  });
  it('still lets a nine-hole course be played twice round', () => {
    const shiloh = BUILT_IN_COURSES.find((c) => c.id === 'builtin-shiloh-park')!;
    expect(teesFor(shiloh, 18).length).toBe(shiloh.tees.length);
  });
});

describe('Vernon Hills Muni', () => {
  it('is one nine-hole course, named the way locals say it', () => {
    const muni = BUILT_IN_COURSES.find((c) => c.id === 'builtin-vernon-hills')!;
    expect(muni.name).toBe('Vernon Hills Muni');
    expect(muni.place).toBe('Vernon Hills, IL');
    expect(muni.tees.every((t) => t.pars.length === 9 && t.pars.reduce((a, b) => a + b) === 34)).toBe(true);
    expect(muni.tees[0]).toMatchObject({ name: 'Blue', yards: 2836, rating: 34.5, slope: 124 });
  });
});

describe('a course saved twice', () => {
  it('rates a round off the copy with ratings, not the old unrated one', () => {
    const old: SavedCourse = { id: 'th', name: 'Thunderhawk', tees: [{ name: 'Silver', pars: Array(18).fill(4) }] };
    const sharedCopy: SavedCourse = {
      id: 'th',
      name: 'Thunderhawk',
      tees: [{ name: 'Silver', pars: Array(18).fill(4), rating: 70.5, slope: 134 }],
    };
    expect(teeOf({ courseId: 'th', tee: 'Silver' } as Round, [old, sharedCopy])).toMatchObject({ rating: 70.5 });
  });
});

describe('Ivanhoe Club', () => {
  const ivanhoe = BUILT_IN_COURSES.find((c) => c.id === 'builtin-ivanhoe')!;
  it('has its three nines in every order, with every tee box BlueGolf rates', () => {
    expect(ivanhoe.place).toBe('Ivanhoe, IL');
    expect(ivanhoe.tees).toHaveLength(6 * 14);
    expect(ivanhoe.tees.find((t) => t.name === 'Forest/Marsh · Gold')).toMatchObject({
      yards: 7086,
      rating: 75.3,
      slope: 147,
    });
    expect(ivanhoe.tees.find((t) => t.name === 'Prairie/Marsh · White (W)')).toMatchObject({
      rating: 75.5,
      slope: 141,
    });
    expect(ivanhoe.tees.every((t) => t.pars.reduce((a, b) => a + b) === 72)).toBe(true);
  });
});
