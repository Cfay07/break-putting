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

export const BUILT_IN_COURSES: SavedCourse[] = [
  {
    id: 'builtin-ives-grove',
    name: 'Ives Grove Golf Links',
    place: 'Sturtevant, WI',
    tees: combinations(IVES_NINES),
  },
];
