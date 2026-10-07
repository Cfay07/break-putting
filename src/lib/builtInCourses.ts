import type { SavedCourse } from './types';

/**
 * Courses the golf course API does not carry. Ives Grove has three nines, so every playable
 * eighteen is one of the six orderings. Pars come off the BlueGolf scorecards, where the Blue nine
 * appears on two different cards with the same numbers.
 */
const IVES_NINES: Record<string, number[]> = {
  Blue: [5, 4, 4, 4, 3, 4, 3, 4, 5],
  White: [5, 3, 4, 4, 5, 4, 4, 3, 4],
  Red: [4, 4, 3, 4, 5, 3, 4, 4, 5],
};

function combinations(nines: Record<string, number[]>) {
  const names = Object.keys(nines);
  return names.flatMap((out) =>
    names
      .filter((back) => back !== out)
      .map((back) => ({ name: `${out}/${back}`, pars: [...nines[out], ...nines[back]] })),
  );
}

/**
 * Out 36, in 34. Sources disagree on the second hole: some print it as a par 4, which would make
 * the course a 71. The club publishes a par 70 and this is the only reading that adds up to it,
 * so the long second plays as a par 3.
 */
const PETRIFYING_PARS = [4, 3, 4, 3, 4, 4, 4, 5, 5, 4, 4, 3, 4, 4, 4, 3, 4, 4];

export const BUILT_IN_COURSES: SavedCourse[] = [
  {
    id: 'builtin-ives-grove',
    name: 'Ives Grove Golf Links',
    place: 'Sturtevant, WI',
    tees: combinations(IVES_NINES),
  },
  {
    id: 'builtin-petrifying-springs',
    name: 'Petrifying Springs Golf Course',
    place: 'Kenosha, WI',
    tees: [
      { name: 'White', yards: 5979, pars: PETRIFYING_PARS },
      { name: 'Red', yards: 5588, pars: PETRIFYING_PARS },
      { name: 'Orange', yards: 5337, pars: PETRIFYING_PARS },
    ],
  },
];
