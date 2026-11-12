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

/**
 * Back-tee rating and slope for each pair of nines, from GolfPass. Red/White 72.8/130, Blue/Red
 * 73.0/131, and the White/Blue card's Blue tees 73.0/131. Same two nines either way round.
 */
const IVES_RATED: Record<string, [number, number]> = {
  'Red+White': [72.8, 130],
  'Blue+Red': [73.0, 131],
  'Blue+White': [73.0, 131],
};

function combinations(nines: Record<string, number[]>) {
  const names = Object.keys(nines);
  return names.flatMap((out) =>
    names
      .filter((back) => back !== out)
      .map((back) => {
        const [rating, slope] = IVES_RATED[[out, back].sort().join('+')];
        return { name: `${out}/${back}`, pars: [...nines[out], ...nines[back]], rating, slope };
      }),
  );
}

/**
 * Out 36, in 34, par 70, off the 18Birdies card. GolfLink prints the second as a par 4 and then
 * contradicts itself by calling the course a 70; it is a 232 yard par 3, stroke index 13.
 */
const PETRIFYING_PARS = [4, 3, 4, 3, 4, 4, 4, 5, 5, 4, 4, 3, 4, 4, 4, 3, 4, 4];

/** Out 35, in 37, par 72. Off the 18Birdies card, which GolfPass matches hole for hole. */
const BROWNS_LAKE_PARS = [4, 4, 3, 4, 4, 5, 4, 3, 4, 4, 4, 4, 3, 5, 5, 4, 3, 5];

/**
 * Nine holes, par 35. The course API carries Shiloh but with an empty tee list, so it arrives
 * with nothing to pick. GolfLink and GolfPass print the same card hole for hole, and the Blue
 * total matches the 2863 on the 18Birdies card from the round played off it.
 */
const SHILOH_PARS = [4, 5, 4, 3, 4, 4, 3, 4, 4];

/**
 * Nine holes, par 35, and the course API has never heard of it: a search for Shoop, Shoop Park
 * or Shoop Park Racine all come back empty, so it had to be typed in.
 *
 * Two sites print "par 34" in their header and then a scorecard that adds to 35, which looks
 * like one bad figure on a shared feed. GolfPass says 35 outright, and three sources give the
 * same hole-by-hole, so the holes win.
 */
const SHOOP_PARS = [3, 5, 4, 5, 3, 4, 4, 3, 4];

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
    // Two tees on the 18Birdies card. Other sites name the 5588 "Red" and add a 5337 nobody
    // else lists, so this follows the one source that got every par right.
        tees: [
      // GolfPass and GolfNow: White 67.8/119, Orange (women's) 70.9/122.
      { name: 'White', yards: 5979, pars: PETRIFYING_PARS, rating: 67.8, slope: 119 },
      { name: 'Orange', yards: 5588, pars: PETRIFYING_PARS, rating: 70.9, slope: 122 },
    ],
  },
  {
    id: 'builtin-browns-lake',
    name: 'Browns Lake Golf Course',
    place: 'Burlington, WI',
        tees: [
      // 18Birdies, on the same 6386 yards: 70.8/124. Nobody publishes Yellow or the 5119 Red.
      { name: 'White', yards: 6386, pars: BROWNS_LAKE_PARS, rating: 70.8, slope: 124 },
      { name: 'Yellow', yards: 5391, pars: BROWNS_LAKE_PARS },
      { name: 'Red', yards: 5119, pars: BROWNS_LAKE_PARS },
    ],
  },
  {
    id: 'builtin-shiloh-park',
    name: 'Shiloh Park Golf Course',
    place: 'Zion, IL',
    tees: [
      // Nine-hole ratings, GolfPass. Sites printing 68.4 have doubled the 34.2.
      { name: 'Blue', yards: 2863, pars: SHILOH_PARS, rating: 34.2, slope: 118 },
      { name: 'White', yards: 2695, pars: SHILOH_PARS, rating: 33.7, slope: 115 },
      { name: 'Yellow', yards: 2348, pars: SHILOH_PARS, rating: 33.4, slope: 111 },
    ],
  },
  {
    id: 'builtin-shoop-park',
    name: 'Shoop Park Golf Course',
    place: 'Racine, WI',
    tees: [
      // GolfLink and Foretee, nine holes: 35.5/113. No published figure for the Red.
      { name: 'White', yards: 2667, pars: SHOOP_PARS, rating: 35.5, slope: 113 },
      { name: 'Red', yards: 2615, pars: SHOOP_PARS },
    ],
  },
];
