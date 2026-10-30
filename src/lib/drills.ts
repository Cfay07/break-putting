import { fixDrill } from './pinpoint';
import { isLagZone, type AppState, type DrillDef, type Lean, type Station, type Surface, type Zone } from './types';

const BOTH: Surface[] = ['indoor', 'green'];
const GREEN: Surface[] = ['green'];

const at = (d: number, balls: number, extra: Partial<Station> = {}): Station => ({ d, balls, ...extra });

/** The app's own drills. Imported and built drills join these; nothing here is ever edited in place. */
export const APP_DRILLS: DrillDef[] = [
  {
    id: 'run-3',
    name: 'Three-foot run',
    scoring: 'streak',
    stations: [at(3, 0)],
    how: 'Make as many in a row as you can from 3 feet. A miss starts the count over. Stop when you want.',
    surfaces: BOTH,
  },
  {
    id: 'ten-4',
    name: 'Ten from 4 feet',
    scoring: 'count',
    stations: [at(4, 10)],
    how: 'Ten balls from 4 feet. On a green, move round the hole between balls.',
    surfaces: BOTH,
  },
  {
    id: 'gate-6',
    name: 'Gate at 6 feet',
    scoring: 'count',
    stations: [at(6, 10)],
    how: 'Two tees a putterhead apart, a foot in front of the ball. Only putts that go through clean and drop count.',
    surfaces: BOTH,
    fixes: ['start-line'],
  },
  {
    id: 'ten-6',
    name: 'Ten from 6 feet',
    scoring: 'count',
    stations: [at(6, 10)],
    how: 'Ten balls from 6 feet. Same line on a mat, round the hole on a green.',
    surfaces: BOTH,
  },
  {
    id: 'ladder-6-10',
    name: '6 to 10 ladder',
    scoring: 'count',
    stations: [at(6, 2), at(7, 2), at(8, 2), at(9, 2), at(10, 2)],
    how: 'Two balls each from 6, 7, 8, 9 and 10 feet. Count the ones that drop.',
    surfaces: BOTH,
  },
  {
    id: 'twelve',
    name: 'Twelve feet, nothing long',
    scoring: 'count',
    stations: [at(12, 10, { mode: 'zone', zoneFt: 1.5 })],
    how: 'Ten balls from 12 feet. A ball counts if it drops or stops within 18 inches past.',
    surfaces: BOTH,
  },
  {
    id: 'apex',
    name: 'Apex tee',
    scoring: 'count',
    stations: [at(8, 10)],
    how: 'Pick the apex of the break, put a tee there, and roll ten from 8 feet over it.',
    surfaces: GREEN,
    fixes: ['high', 'low'],
  },
  {
    id: 'lag-ladder',
    name: 'Lag ladder',
    scoring: 'count',
    stations: [30, 40, 50, 60].map((d) => at(d, 3, { mode: 'zone', zoneFt: d / 10 })),
    how: 'Three balls each from 30, 40, 50 and 60 feet. A ball counts inside a tenth of the putt: 3 feet from 30, 6 from 60.',
    surfaces: BOTH,
  },
  {
    id: 'past-it',
    name: 'Past the hole',
    scoring: 'count',
    stations: [at(20, 10, { mode: 'zone', zoneFt: 1.5 })],
    how: 'From 20 feet, every ball has to finish 12 to 18 inches past. Count the ones that do.',
    surfaces: BOTH,
    fixes: ['short'],
  },
  {
    id: 'die-it',
    name: 'Die it',
    scoring: 'count',
    stations: [at(25, 10, { mode: 'zone', zoneFt: 2 })],
    how: 'From 25 feet, stop the ball in a 2-foot zone just past the hole.',
    surfaces: BOTH,
    fixes: ['long'],
  },
  {
    id: 'two-putt-ladder',
    name: 'Two-putt 20, 30, 40',
    scoring: 'count',
    stations: [20, 30, 40].map((d) => at(d, 1, { mode: 'twoputt' })),
    how: 'One ball each from 20, 30 and 40 feet. It counts if you are in the hole in two.',
    surfaces: BOTH,
  },
  {
    id: 'ladder-3-6',
    name: '3 to 6 ladder',
    scoring: 'count',
    stations: [3, 4, 5, 6].map((d) => at(d, 3)),
    how: 'Three balls each from 3, 4, 5 and 6 feet. Count the ones that drop.',
    surfaces: BOTH,
  },
  {
    id: 'firm-3',
    name: 'Firm three-footers',
    scoring: 'count',
    stations: [at(3, 10)],
    how: 'Ten from 3 feet, each hit firm enough to finish a foot past if it misses. Lip-outs and a decelerating stroke both show up here.',
    surfaces: BOTH,
    fixes: ['short'],
  },
  {
    id: 'clock-4',
    name: 'Around the clock at 4',
    scoring: 'count',
    stations: [at(4, 8)],
    how: 'Eight balls in a circle 4 feet from the hole, so every putt breaks a different way. Read each one.',
    surfaces: GREEN,
    fixes: ['high', 'low'],
  },
  {
    id: 'uphill-8',
    name: 'Uphill eights',
    scoring: 'count',
    stations: [at(8, 10)],
    how: 'Ten uphill 8-footers from the same spot, hit firm enough to take the break out.',
    surfaces: GREEN,
    fixes: ['short'],
  },
  {
    id: 'downhill-10',
    name: 'Downhill tens',
    scoring: 'count',
    stations: [at(10, 10, { mode: 'zone', zoneFt: 1.5 })],
    how: 'Ten downhill 10-footers. A ball counts if it drops or stops within 18 inches past.',
    surfaces: GREEN,
    fixes: ['long'],
  },
  {
    id: 'twenty-thirty',
    name: 'Twenty and thirty',
    scoring: 'count',
    stations: [at(20, 5, { mode: 'zone', zoneFt: 2 }), at(30, 5, { mode: 'zone', zoneFt: 3 })],
    how: 'Five balls each from 20 and 30 feet. A ball counts inside a tenth of the putt: 2 feet from 20, 3 from 30.',
    surfaces: BOTH,
  },
  {
    id: 'left-hand',
    name: 'Left hand only',
    scoring: 'count',
    stations: [3, 4, 5, 6].map((d) => at(d, 5, { hand: 'left' })),
    how: 'Five balls each from 3, 4, 5 and 6 feet with only your left hand on the putter.',
    surfaces: BOTH,
  },
  {
    id: 'right-hand',
    name: 'Right hand only',
    scoring: 'count',
    stations: [3, 4, 5, 6].map((d) => at(d, 5, { hand: 'right' })),
    how: 'Five balls each from 3, 4, 5 and 6 feet with only your right hand on the putter.',
    surfaces: BOTH,
  },
  {
    id: 'back-edge',
    name: 'Pace to the far end',
    scoring: 'count',
    stations: [at(0, 10, { mode: 'zone', zoneFt: 0.5, far: true })],
    how: 'Start at one end of your space and roll each ball to stop within a putter grip of the far end, without touching it. No hole: this is pace for long putts.',
    surfaces: ['indoor'],
  },
].map((d) => ({ putting: true, source: 'app' as const, ...d }) as DrillDef);

/**
 * Every drill this player can roll: their own and imported ones, then the app's. An original
 * that has your edited copy is left out, because the copy is the one you roll.
 */
export function allDrills(state: Pick<AppState, 'drills'>): DrillDef[] {
  const copied = new Set(state.drills.map((d) => d.from).filter(Boolean));
  return [...state.drills, ...APP_DRILLS].filter((d) => !copied.has(d.id));
}

/**
 * The drill to actually roll for an id. Your edited copy stands in for the original everywhere,
 * so editing a drill once changes it in every session that uses it.
 */
export function resolveDrill(state: Pick<AppState, 'drills'>, id: string): DrillDef | undefined {
  const copy = state.drills
    .filter((d) => d.from === id)
    .sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''))[0];
  return copy ?? state.drills.find((d) => d.id === id) ?? APP_DRILLS.find((d) => d.id === id) ?? fixDrill(id);
}

/** The id a drill's history lives under, so an edited copy keeps the original's record. */
export function familyOf(state: Pick<AppState, 'drills'>, id: string): string {
  return state.drills.find((d) => d.id === id)?.from ?? id;
}

export interface FittedStation extends Station {
  /** Where the sheet put it, when your space moved it in. */
  movedFrom?: number;
}

export interface Fitted extends Omit<DrillDef, 'stations'> {
  stations: FittedStation[];
}

/**
 * A drill made to fit the room you have. Every station past the limit moves in to it and keeps
 * where it was, so the drill always runs and always says what changed. Practice-against-play
 * compares each ball at the distance it was actually rolled from, so a moved station never
 * borrows the original distance's numbers.
 */
export function fitToRoom(drill: DrillDef, room: number): Fitted {
  if (!drill.putting) return drill;
  return {
    ...drill,
    stations: drill.stations.map((s) => (s.far ? { ...s, d: room } : s.d > room ? { ...s, d: room, movedFrom: s.d } : s)),
  };
}

/** Room never stops a drill, it only reshapes it. A surface can: no break to read on carpet. */
export function fits(drill: DrillDef, surface: Surface): boolean {
  return drill.surfaces.includes(surface);
}

const ZONE_EDGES: [Zone, number][] = [
  ['tapin', 2],
  ['short', 5],
  ['mid', 8],
  ['long', 15],
  ['far', 30],
  ['lag', 40],
  ['deep', Infinity],
];

export function zoneOfFeet(d: number): Zone {
  return ZONE_EDGES.find(([, max]) => d <= max)![0];
}

/**
 * Share of a drill's balls that land in a zone. A run drill counts as one ball at its distance.
 * A station that goes as far as the room allows is a pace drill for long putts, wherever the
 * room happens to end.
 */
export function zoneShare(drill: Fitted, zone: Zone): number {
  const balls = drill.stations.map((s) => ({ d: s.d, far: !!s.far, n: s.balls || 1 }));
  const total = balls.reduce((s, b) => s + b.n, 0);
  if (!total) return 0;
  const inZone = (b: (typeof balls)[number]) => (b.far ? zone === 'long' || zone === 'far' : zoneOfFeet(b.d) === zone);
  return balls.filter(inZone).reduce((s, b) => s + b.n, 0) / total;
}

/** At most three, so the card names a drill instead of handing over a menu. */
export const MAX_DRILLS = 3;

/**
 * Drills for a zone on this surface, from everything the player has. A drill aimed at the habit
 * the misses show goes first, then the ones that spend most of their balls in the zone.
 */
export function drillsFor(
  drills: DrillDef[],
  zone: Zone,
  lean: Lean | null,
  surface: Surface,
  room: number,
): Fitted[] {
  const scored = drills
    .filter((d) => d.putting && !d.partner && d.surfaces.includes(surface) && d.scoring !== 'game')
    .map((d, i) => ({ f: fitToRoom(d, room), i }))
    .map((x) => ({
      ...x,
      share: zoneShare(x.f, zone),
      // Lag drills spread over several long zones, so any lag zone counts them together.
      lagShare: isLagZone(zone) ? zoneShare(x.f, 'far') + zoneShare(x.f, 'lag') + zoneShare(x.f, 'deep') : 0,
    }))
    .filter((x) => x.share >= 0.5 || (x.share > 0 && x.lagShare >= 0.5));
  const aimed = (f: Fitted) => (!f.fixes ? 1 : lean && f.fixes.includes(lean) ? 0 : 2);
  return scored
    .sort((a, b) => aimed(a.f) - aimed(b.f) || b.share - a.share || b.lagShare - a.lagShare || a.i - b.i)
    .map((x) => x.f)
    .slice(0, MAX_DRILLS);
}

export function distanceText(drill: Pick<DrillDef, 'stations'>): string {
  const ds = [...new Set(drill.stations.filter((s) => s.d > 0).map((s) => s.d))];
  if (!ds.length) return '';
  if (ds.length === 1) return `${ds[0]} ft`;
  if (ds.length <= 4) return `${ds.join('/')} ft`;
  return `${Math.min(...ds)} to ${Math.max(...ds)} ft`;
}

/** The scoring in words, by what the balls are actually judged on. */
export function scoringLabel(d: Pick<DrillDef, 'scoring' | 'stations'>): string {
  if (d.scoring !== 'count' || !d.stations.length) return SCORING_LABELS[d.scoring];
  const modes = new Set(d.stations.map((s) => s.mode ?? 'make'));
  if (modes.size === 1 && modes.has('zone')) return 'Inside the zone';
  if (modes.size === 1 && modes.has('twoputt')) return 'Two-putt or not';
  return SCORING_LABELS.count;
}

export const SCORING_LABELS: Record<DrillDef['scoring'], string> = {
  count: 'Made out of',
  ladder: 'How far you got',
  streak: 'In a row',
  game: 'Head to head',
  done: 'Just mark it done',
};
