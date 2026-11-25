import type { SavedCourse } from './types';

/**
 * Courses whose eighteen is two named nines, so "Red/White" is part of where you played. Everywhere
 * else a slash in a name is a combo tee, like "Black / Gold", and belongs with the tees.
 */
export const NAMED_NINES = new Set(['builtin-ives-grove', 'builtin-ivanhoe']);

/**
 * Courses the golf course API does not carry. Ives Grove has three nines, so every playable
 * eighteen is one of the six orderings. Pars come off the BlueGolf scorecards, where each nine
 * appears on two different cards with the same numbers.
 */
const IVES_NINES: Record<string, number[]> = {
  Blue: [5, 4, 4, 4, 3, 4, 3, 4, 5],
  White: [5, 3, 4, 4, 5, 4, 4, 3, 4],
  Red: [4, 4, 3, 4, 5, 3, 4, 4, 5],
};

/** Yards for each tee box on each nine, the same on every BlueGolf card the nine appears on. */
const IVES_YARDS: Record<string, Record<string, number>> = {
  Red: { Blue: 3490, White: 3235, Gold: 2975, Red: 2695 },
  White: { Blue: 3475, White: 3215, Gold: 2945, Red: 2725 },
  Blue: { Blue: 3510, White: 3235, Gold: 2975, Red: 2705 },
};

/**
 * Rating and slope for every tee box on each pair of nines, off the three BlueGolf detailed
 * scorecards (Red/White, Blue/Red, White/Blue). Gold is rated for men and women; Red only for
 * women, so it carries the (W) and never passes for a men's rating. Same two nines either way
 * round. No rating is published for a single nine.
 */
const IVES_RATED: Record<string, [string, number, number][]> = {
  'Red+White': [
    ['Blue', 72.8, 130],
    ['White', 70.5, 124],
    ['Gold', 68.0, 118],
    ['Gold (W)', 73.5, 128],
    ['Red (W)', 70.4, 121],
  ],
  'Blue+Red': [
    ['Blue', 73.0, 131],
    ['White', 70.5, 124],
    ['Gold', 68.1, 119],
    ['Gold (W)', 73.6, 128],
    ['Red (W)', 70.4, 121],
  ],
  'Blue+White': [
    ['Blue', 73.0, 131],
    ['White', 70.6, 124],
    ['Gold', 68.1, 119],
    ['Gold (W)', 73.5, 129],
    ['Red (W)', 71.0, 123],
  ],
};

/** "Red/White · Gold" is the two nines, then the tee box. */
export const NINES_SEP = ' · ';
export const ninesPart = (tee: string) => tee.split(NINES_SEP)[0];
/** Rounds saved before tee boxes existed say only "Red/White": they were rated off the Blue box. */
export const OLD_NINES_BOX = 'Blue';

type Rated = Record<string, [string, number, number][]>;

/** Every ordering of two nines, each tee box rated for that pair, as "Out/In · Box". */
function combinations(nines: Record<string, number[]>, yards: Record<string, Record<string, number>>, rated: Rated) {
  const names = Object.keys(nines);
  return names.flatMap((out) =>
    names
      .filter((back) => back !== out)
      .flatMap((back) =>
        rated[[out, back].sort().join('+')].map(([box, rating, slope]) => {
          const plain = box.replace(' (W)', '');
          return {
            name: `${out}/${back}${NINES_SEP}${box}`,
            yards: yards[out][plain] + yards[back][plain],
            pars: [...nines[out], ...nines[back]],
            rating,
            slope,
          };
        }),
      ),
  );
}

/**
 * Ivanhoe Club's three nines, off the three BlueGolf detailed scorecards (Forest/Marsh,
 * Marsh/Prairie, Forest/Prairie). Each nine prints the same pars and yards on both cards it is on.
 */
const IVANHOE_NINES: Record<string, number[]> = {
  Forest: [4, 4, 5, 3, 4, 3, 4, 4, 5],
  Marsh: [5, 4, 3, 4, 4, 5, 4, 3, 4],
  Prairie: [4, 4, 4, 3, 5, 3, 4, 4, 5],
};

const IVANHOE_YARDS: Record<string, Record<string, number>> = {
  Forest: {
    Gold: 3508,
    Black: 3389,
    Green: 3238,
    'Green/White': 3109,
    White: 3069,
    Silver: 2925,
    Combo: 2771,
    Copper: 2565,
  },
  Marsh: {
    Gold: 3578,
    Black: 3384,
    Green: 3225,
    'Green/White': 3107,
    White: 3028,
    Silver: 2869,
    Combo: 2742,
    Copper: 2581,
  },
  Prairie: {
    Gold: 3481,
    Black: 3323,
    Green: 3196,
    'Green/White': 3083,
    White: 3009,
    Silver: 2842,
    Combo: 2733,
    Copper: 2583,
  },
};

/** Men's rating for every box and women's for six, per pair of nines, as BlueGolf prints them. */
const IVANHOE_RATED: Rated = {
  'Forest+Marsh': [
    ['Gold', 75.3, 147],
    ['Black', 73.9, 144],
    ['Green', 72.5, 141],
    ['Green/White', 71.4, 139],
    ['White', 70.8, 137],
    ['Silver', 69.4, 134],
    ['Combo', 67.9, 131],
    ['Copper', 66.5, 127],
    ['Black (W)', 80.2, 145],
    ['Green (W)', 78.4, 140],
    ['White (W)', 76.5, 137],
    ['Silver (W)', 74.8, 133],
    ['Combo (W)', 73.2, 129],
    ['Copper (W)', 71.2, 125],
  ],
  'Marsh+Prairie': [
    ['Gold', 75.2, 152],
    ['Black', 73.5, 148],
    ['Green', 72.2, 146],
    ['Green/White', 71.3, 143],
    ['White', 70.5, 140],
    ['Silver', 68.9, 138],
    ['Combo', 68.0, 136],
    ['Copper', 66.6, 132],
    ['Black (W)', 79.8, 154],
    ['Green (W)', 78.3, 150],
    ['White (W)', 75.5, 141],
    ['Silver (W)', 73.7, 136],
    ['Combo (W)', 72.6, 134],
    ['Copper (W)', 70.9, 130],
  ],
  'Forest+Prairie': [
    ['Gold', 75.1, 148],
    ['Black', 73.8, 145],
    ['Green', 72.5, 142],
    ['Green/White', 71.3, 140],
    ['White', 70.9, 138],
    ['Silver', 69.5, 135],
    ['Combo', 68.1, 132],
    ['Copper', 66.7, 128],
    ['Black (W)', 79.8, 145],
    ['Green (W)', 78.2, 141],
    ['White (W)', 76.4, 137],
    ['Silver (W)', 74.7, 133],
    ['Combo (W)', 73.2, 130],
    ['Copper (W)', 71.3, 126],
  ],
};

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

/**
 * Out 36, in 36, par 72. Pars from the round imported off this course; ratings from the GolfPass
 * tee table. The open course data only knows the club's par-3 course, and the main course service
 * does not list Como Crossings at all.
 */
/**
 * Nine holes, par 34, played twice round for a 68. Pars, yards and nine-hole ratings off the
 * BlueGolf detailed scorecard (vernonhillsgc1), which 18Birdies matches at 34.5/124 from the Blue.
 * Locals call it the Muni, so that is its name here, and "muni" or "Vernon Hills" both find it.
 */
const VERNON_HILLS_PARS = [4, 4, 3, 4, 4, 4, 3, 4, 4];

const COMO_PARS = [4, 4, 3, 4, 4, 3, 5, 4, 5, 5, 3, 4, 4, 5, 4, 4, 3, 4];

export const BUILT_IN_COURSES: SavedCourse[] = [
  {
    id: 'builtin-como-crossings',
    name: "Hawk's View Golf Club · Como Crossings",
    place: 'Lake Geneva, WI',
    tees: [
      { name: 'Black', yards: 7074, pars: COMO_PARS, rating: 73.1, slope: 133 },
      { name: 'Blue', yards: 6595, pars: COMO_PARS, rating: 71.0, slope: 128 },
      { name: 'White', yards: 6210, pars: COMO_PARS, rating: 69.2, slope: 124 },
      { name: 'Gold', yards: 5701, pars: COMO_PARS, rating: 66.9, slope: 118 },
      // Women's rating, the only one published for the Red.
      { name: 'Red', yards: 5115, pars: COMO_PARS, rating: 69.3, slope: 115 },
    ],
  },
  {
    id: 'builtin-ives-grove',
    name: 'Ives Grove Golf Links',
    place: 'Sturtevant, WI',
    tees: combinations(IVES_NINES, IVES_YARDS, IVES_RATED),
  },
  {
    id: 'builtin-petrifying-springs',
    name: 'Petrifying Springs Golf Course',
    place: 'Kenosha, WI',
    // Two tees on the 18Birdies card. Other sites name the 5588 "Red" and add a 5337 nobody
    // else lists, so this follows the one source that got every par right.
    tees: [
      // BlueGolf men's: White 67.8/119, the forward tee (their Red) 66.0/115.
      { name: 'White', yards: 5979, pars: PETRIFYING_PARS, rating: 67.8, slope: 119 },
      { name: 'Orange', yards: 5588, pars: PETRIFYING_PARS, rating: 66.0, slope: 115 },
    ],
  },
  {
    id: 'builtin-browns-lake',
    name: 'Browns Lake Golf Course',
    place: 'Burlington, WI',
    tees: [
      // BlueGolf men's ratings.
      { name: 'White', yards: 6386, pars: BROWNS_LAKE_PARS, rating: 71.1, slope: 126 },
      { name: 'Yellow', yards: 5391, pars: BROWNS_LAKE_PARS, rating: 65.8, slope: 115 },
      { name: 'Red', yards: 5119, pars: BROWNS_LAKE_PARS, rating: 64.1, slope: 109 },
    ],
  },
  {
    id: 'builtin-shiloh-park',
    name: 'Shiloh Park Golf Course',
    place: 'Zion, IL',
    tees: [
      // BlueGolf rates it as eighteen (twice round): Blue 67.6/122, White 66.0/118, Yellow
      // (women's only) 67.2/114. Halved for the nine.
      { name: 'Blue', yards: 2863, pars: SHILOH_PARS, rating: 33.8, slope: 122 },
      { name: 'White', yards: 2695, pars: SHILOH_PARS, rating: 33.0, slope: 118 },
      { name: 'Yellow', yards: 2348, pars: SHILOH_PARS, rating: 33.6, slope: 114 },
    ],
  },
  {
    id: 'builtin-shoop-park',
    name: 'Shoop Park Golf Course',
    place: 'Racine, WI',
    tees: [
      // BlueGolf men's, rated as eighteen: White 66.2/104, Red 65.2/102. Halved for the nine.
      { name: 'White', yards: 2667, pars: SHOOP_PARS, rating: 33.1, slope: 104 },
      { name: 'Red', yards: 2615, pars: SHOOP_PARS, rating: 32.6, slope: 102 },
    ],
  },
  {
    id: 'builtin-ivanhoe',
    name: 'Ivanhoe Club',
    place: 'Ivanhoe, IL',
    tees: combinations(IVANHOE_NINES, IVANHOE_YARDS, IVANHOE_RATED),
  },
  {
    id: 'builtin-vernon-hills',
    name: 'Vernon Hills Muni',
    place: 'Vernon Hills, IL',
    tees: [
      { name: 'Blue', yards: 2836, pars: VERNON_HILLS_PARS, rating: 34.5, slope: 124 },
      { name: 'White', yards: 2750, pars: VERNON_HILLS_PARS, rating: 34.1, slope: 122 },
      { name: 'White (W)', yards: 2750, pars: VERNON_HILLS_PARS, rating: 36.2, slope: 128 },
      { name: 'Red (W)', yards: 2310, pars: VERNON_HILLS_PARS, rating: 33.7, slope: 116 },
    ],
  },
];
