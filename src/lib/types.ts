export type MissSide = 'high' | 'low' | 'online';
export type Speed = 'short' | 'good' | 'long';

/**
 * Where the ball crossed the rim on a holed putt. Eight points round the edge and no middle:
 * a ball always enters somewhere on the rim, so the centre-cut putt is the front door rather
 * than a ninth option in the middle.
 *
 * Six o'clock is always the side the ball came from, so left and right mean the same thing for
 * every player on every green. "unsure" is a real answer, not a cop-out: eight selectable points
 * should never force eight-point precision out of someone who did not see it drop.
 *
 * Observation only. It cannot establish pace or confirm a read on its own, because entry point
 * is a joint result of line, speed and break together, and a back-door entry can come from too
 * much pace or from a putt that took the break late.
 */
export type CupEntry =
  | 'front'
  | 'just-left'
  | 'inside-left'
  | 'left'
  | 'back-left'
  | 'back'
  | 'back-right'
  | 'right'
  | 'inside-right'
  | 'just-right'
  | 'unsure';

/**
 * Clockwise from the near side, so the order matches the ring the picker draws.
 *
 * Ten rather than eight, and the two extra both sit in the front half on purpose. Room to spare
 * only varies there, and with eight points a side had three readings: dead centre, inside edge,
 * lip. "Just left" and "just right" put a fourth between the first two, which is where most
 * holed putts actually cross.
 */
export const CUP_ENTRIES: Exclude<CupEntry, 'unsure'>[] = [
  'front', 'just-left', 'inside-left', 'left', 'back-left',
  'back', 'back-right', 'right', 'inside-right', 'just-right',
];

export const CUP_LABELS: Record<CupEntry, string> = {
  front: 'Front door',
  'just-left': 'Just left of centre',
  'just-right': 'Just right of centre',
  'inside-left': 'Inside left edge',
  left: 'Left edge',
  'back-left': 'Back door left',
  back: 'Back door',
  'back-right': 'Back door right',
  right: 'Right edge',
  'inside-right': 'Inside right edge',
  unsure: "Didn't see it",
};

/** Degrees anticlockwise from three o'clock, for drawing. Six o'clock is where the ball started. */
export const CUP_ANGLES: Record<Exclude<CupEntry, 'unsure'>, number> = {
  right: 0, 'back-right': 45, back: 90, 'back-left': 135, left: 180,
  'inside-left': 210, 'just-left': 240, front: 270, 'just-right': 300, 'inside-right': 330,
};
export type BreakDir = 'L→R' | 'R→L' | 'straight' | 'uphill' | 'downhill';

export const GREEN_SPEEDS = ['slow', 'medium', 'fast', 'glass'] as const;
export type GreenSpeed = (typeof GREEN_SPEEDS)[number];

/**
 * Stimp bands, so the pick means the same thing to everyone. A six-footer on 13 is not the
 * putt a six-footer on 9 is, and pooling them hides it.
 */
export const GREEN_SPEED_LABELS: Record<GreenSpeed, string> = {
  slow: 'Slow',
  medium: 'Medium',
  fast: 'Fast',
  glass: 'Glass',
};
export const GREEN_SPEED_STIMP: Record<GreenSpeed, string> = {
  slow: '8-9',
  medium: '9-11',
  fast: '11-13',
  glass: '13+',
};

export interface Putt {
  d: number;
  made: boolean;
  missSide?: MissSide;
  speed?: Speed;
  /** Superseded by breakDirs; still read so older putts keep their tag. */
  breakDir?: BreakDir;
  /** A putt can break both ways and run uphill, so this holds more than one. */
  breakDirs?: BreakDir[];
  lip?: boolean;
  push?: boolean;
  pull?: boolean;
  /** Quit on it. A tempo fault rather than a face or path one, so it stands on its own. */
  decel?: boolean;
  /** Jabbed at it. The opposite tempo fault, and nothing could say it before. */
  accel?: boolean;
  /**
   * How the break looked before the putt and how much it actually moved, 1 slight to 4 severe.
   * Two taps on one scale: the second only when the read was wrong, so the gap between them is
   * the read error and nobody has to subtract anything by eye.
   *
   * Curves rather than numbers on purpose. A numeric read locks out anyone who does not count
   * fingers, and the scale is relative, so "barely moved" means the same thing at six feet and
   * at forty, which is what cups could never do.
   */
  readAs?: number;
  brokeAs?: number;
  /**
   * It broke the opposite way to the read. Its own field rather than a fifth stop on the scale,
   * because the scale measures how much and this measures which way: a complete misread is not
   * a bigger version of reading too little, it is a different mistake. Stored alongside readAs,
   * which still holds what was seen, so nothing has to lie about what the player read.
   */
  wrongWay?: boolean;
  /**
   * Where on the face it came off. Distinct from push and pull: a square face can still catch
   * the toe, and that putt goes offline and short at once, so logging it as either a push or
   * bad speed blames the wrong thing.
   */
  strike?: 'toe' | 'centre' | 'heel';
  /**
   * How much it ran uphill or down, 1 slight to 3 steep. Only meaningful once a slope is tagged,
   * and only ever asked for then.
   *
   * Break has had an amount since the start and slope has not, so a gentle downhiller and one you
   * had to die at the hole were the same putt to every model. Three steps rather than the read's
   * four: slope does not need the resolution, and a scale nobody can place is worse than a
   * coarser one everybody can.
   */
  slopeAs?: number;
  /**
   * Where it crossed the rim, on a holed putt only. The make-side twin of missSide: a miss has
   * always been asked where it finished and a make was asked nothing, so holed putts ended the
   * record instead of adding to it.
   */
  cupEntry?: CupEntry;
  /**
   * Whether the stroke was actually looked at. Without it a putt with no faults ticked is
   * indistinguishable from a putt nobody reviewed, and both land in the clean pile: any model
   * fit on that is learning from a clean group half full of putts nobody judged.
   *
   * Set by ticking a fault or by saying outright that nothing was wrong. Never inferred from an
   * empty set, and never backfilled onto old putts, which are genuinely unknown and have to stay
   * that way.
   */
  executionAssessed?: boolean;
}

export interface Hole {
  hole: number;
  putts: Putt[];
  par?: number;
  strokes?: number;
  /** Set directly by the importer, which only ever sees a running score. */
  vsPar?: number;
  /** Finished from off the green, so the hole is done with no putts on it. */
  holedOut?: boolean;
}

/** What the hole cost against par, however it was recorded. */
export function holeVsPar(h: Hole): number | undefined {
  if (h.par !== undefined && h.strokes !== undefined) return h.strokes - h.par;
  return h.vsPar;
}

/**
 * Did the ball go in from off the green? A chip-in is not a putt, so it never belongs in the
 * putting numbers. Imported rounds carry no flag, so a scored hole with no putts on it is
 * taken as one too.
 */
export function holedOut(h: Hole): boolean {
  if (h.putts.length) return false;
  // An explicit flag always wins, so undoing a chip-in really undoes it. Only fall back to
  // inference for imported rounds, which carry a score but were never flagged.
  if (h.holedOut !== undefined) return h.holedOut;
  return h.strokes !== undefined || h.vsPar !== undefined;
}

export interface Round {
  id: string;
  label: string;
  date: string;
  course?: string;
  putterId: string;
  score?: number;
  /**
   * Removed from the UI. Nought of 27 rounds ever carried it and it fed no stat, because greens
   * in regulation is worked out from par, strokes and putts instead. Kept on the type so an old
   * round that has one still parses.
   */
  greens?: number;
  recordedPutts?: number;
  /**
    * Played in competition. Kept per round rather than as a setting, because it is a fact about
    * the round and the whole point is comparing these against the casual ones later.
    */
  competitive?: boolean;
  /** How the greens were rolling. One pick for the round, taken before the first hole. */
  greenSpeed?: GreenSpeed;
  /** Named nines, for courses with more than eighteen holes. First is holes 1-9. */
  firstNine?: string;
  secondNine?: string;
  courseId?: string;
  tee?: string;
  /** Greens punched. The single biggest thing that happens to a putting surface. */
  aerated?: boolean;
  /** 1 smooth, 2 average, 3 bumpy. How true the surface rolled. */
  bumpy?: number;
  /** When this round last changed, so two devices can merge by taking the newer copy. */
  updated?: string;
  /**
   * A practice round: logged putt by putt like a real one, no score. Practice rounds live in their
   * own list, so nothing that reads real rounds can ever see one.
   */
  practice?: { surface: Surface };
  holeCount: number;
  holes: Hole[];
  finished: boolean;
}

export interface SavedTee {
  name: string;
  yards?: number;
  /** Par for each hole in order. Nine entries for a nine-hole course. */
  pars: number[];
}

export interface SavedCourse {
  id: string;
  name: string;
  place?: string;
  tees: SavedTee[];
}

export interface Putter {
  id: string;
  name: string;
  active: boolean;
  retired: boolean;
  updated?: string;
}

export interface Tombstone {
  id: string;
  kind: 'round' | 'putter' | 'practice';
  at: string;
}

export interface TrackUI {
  hole: number;
  phase: 'distance' | 'tags';
  distanceInput: string;
  draft: Partial<Putt> | null;
}

export interface AppState {
  version: number;
  putters: Putter[];
  courses: SavedCourse[];
  rounds: Round[];
  baseline: [number, number][];
  track: TrackUI;
  /** Rounds removed on this device, so a device that was offline cannot resurrect them. */
  tombstones: Tombstone[];
  /** When the baseline and saved courses last changed. */
  settingsUpdated?: string;
  /** Hides the running score and the bleed drop while playing, for competitive rounds. */
  quietTrack?: boolean;
  /** Drill sets. Kept apart from rounds so nothing that reads a round can ever read these. */
  practice: PracticeSet[];
  /** Drills you built or imported, and your edited copies of anyone else's. */
  drills: DrillDef[];
  /** Practice rounds. Never in `rounds`, so no stat, model or team page reads them. */
  practiceRounds: Round[];
  sessions: SessionDef[];
  /** Longest putt there is room for, per surface. Drills fit themselves to it. */
  room: Record<Surface, number>;
  /** A session in progress on this phone. Never synced: it is a stopwatch, not a record. */
  run?: SessionRun;
  /** Where you are putting today, on this phone. */
  surface?: Surface;
}

/** Indoor is a mat or a facility green: flat and true. Green is real grass with real break. */
export type Surface = 'indoor' | 'green';

export const SURFACE_LABELS: Record<Surface, string> = { indoor: 'Indoor', green: 'Green' };

export const DEFAULT_ROOM: Record<Surface, number> = { indoor: 12, green: 60 };

/** Distance zones, each owning the putts that start inside it. */
export type Zone = 'tapin' | 'short' | 'mid' | 'long' | 'far' | 'lag' | 'deep';

/** Zones judged on where the ball finishes rather than whether it dropped. */
export function isLagZone(z: Zone): boolean {
  return z === 'far' || z === 'lag' || z === 'deep';
}

/** What the tagged misses from a zone keep doing, when they agree. */
export type Lean = 'start-line' | 'short' | 'long' | 'high' | 'low';

/**
 * count: every ball scored at its station. ladder: stations cleared in order, a miss does what
 * the drill says. streak: makes in a row, a miss starts over. game: head to head. done: a block
 * with nothing to score, like range work.
 */
export type Scoring = 'count' | 'ladder' | 'streak' | 'game' | 'done';

/** What a ball at a station is judged on. Each one has a twin on the course. */
export type BallMode = 'make' | 'twoputt' | 'zone';

/** A station putted with one hand. No hand means both, the normal way. */
export type Hand = 'left' | 'right';

export interface Station {
  d: number;
  balls: number;
  mode?: BallMode;
  /** Makes needed to clear it, on a ladder or as a pass mark. */
  need?: number;
  /** Zone drills: how close counts, in feet. */
  zoneFt?: number;
  /** As far as there is room for: the back of the mat. */
  far?: boolean;
  hand?: Hand;
  label?: string;
}

/** What a failed ladder station does. */
export type OnMiss = 'end' | 'restart' | 'checkpoint' | 'back' | 'stay';

export interface DrillDef {
  id: string;
  name: string;
  scoring: Scoring;
  stations: Station[];
  how: string;
  minutes?: number;
  /** Streaks: makes in a row to finish. None means go until you stop. */
  target?: number;
  /** Minutes on the clock, for drills scored on finishing in time. */
  limit?: number;
  onMiss?: OnMiss;
  /** Station indexes a checkpoint restart goes back to. */
  checkpoints?: number[];
  surfaces: Surface[];
  /** Chipping and range blocks ride along in a session but never meet a putting stat. */
  putting: boolean;
  source: 'app' | 'mine' | 'import';
  /** The drill this is your edited copy of. The original stays as written. */
  from?: string;
  /** Needs a partner or a group, so it is never suggested as something to go do alone. */
  partner?: boolean;
  fixes?: Lean[];
  updated?: string;
  kind?: 'drill';
}

export interface SessionBlock {
  drill: string;
  minutes?: number;
}

export interface SessionDef {
  id: string;
  name: string;
  blocks: SessionBlock[];
  source: 'mine' | 'import';
  updated?: string;
  kind?: 'session';
}

/** Which way a practice miss went, when you said. Optional on every miss. */
export type MissDir = 'left' | 'right' | 'short' | 'long';

export interface StationResult {
  d: number;
  mode: BallMode;
  /** Zone balls: how close counted, so the course is judged by the same circle. */
  zoneFt?: number;
  hand?: Hand;
  made: number;
  attempts: number;
  misses?: Partial<Record<MissDir, number>>;
}

/**
 * One drill, rolled once. A mat putt is flat, true and the same speed every time, so a set is
 * never a round and never feeds strokes gained, xP or the model.
 */
export interface PracticeSet {
  id: string;
  date: string;
  drill: string;
  surface: Surface;
  putterId?: string;
  /** Per distance, so practice can sit next to play at the same distance. */
  stations?: StationResult[];
  /** Balls that counted, whatever counting means for this drill. */
  made: number;
  attempts: number;
  /** Longest run of makes. */
  run?: number;
  /** Ladder stations cleared. */
  reached?: number;
  /** Finished the drill, or finished inside the clock. */
  finished?: boolean;
  seconds?: number;
  game?: { opponent: string; result: 'win' | 'loss' | 'tie'; mine?: number; theirs?: number };
  /** The session this was rolled inside, if any. */
  session?: string;
  updated?: string;
  kind?: 'set';
}

export interface SessionRun {
  session: string;
  surface: Surface;
  startedAt: string;
  block: number;
  blockStartedAt: string;
  /** Block index to the set rolled for it. */
  done: Record<number, string>;
}

/**
 * Scratch-level expected putts. The short end matches what DECADE reports hole for hole; the tail
 * past 30 feet is set to DECADE's implied numbers rather than the flatter published table.
 */
export const DEFAULT_BASELINE: [number, number][] = [
  [1, 1.0], [2, 1.01], [3, 1.04], [4, 1.13], [5, 1.23], [6, 1.34], [7, 1.42], [8, 1.5],
  [9, 1.56], [10, 1.61], [12, 1.7], [15, 1.78], [20, 1.87],
  [25, 1.94], [30, 2.0], [35, 2.02], [40, 2.06], [50, 2.14], [60, 2.21],
];

const WHITE = '#f7f5ee';
const BLACK = '#141414';

/** Putter pills take the brand's colour, so you can read the tag without reading the words. */
const BRAND_PILLS: { match: RegExp; bg: string; ink: string }[] = [
  { match: /scotty|cameron|phantom\s?x|titleist/i, bg: '#c8102e', ink: BLACK },
  // Before Odyssey, so a TRTL reads as its own dark green rather than Odyssey teal.
  { match: /\btrtl\b|turtle/i, bg: '#1e4632', ink: WHITE },
  { match: /odyssey|toulon|callaway/i, bg: '#0e9594', ink: BLACK },
  { match: /taylormade|spider/i, bg: '#8c5a2b', ink: WHITE },
  { match: /\bping\b/i, bg: '#1a4f9c', ink: WHITE },
  { match: /l\.?a\.?b\.?/i, bg: '#1c1c1e', ink: WHITE },
  { match: /cobra/i, bg: '#e8622a', ink: BLACK },
  { match: /bettinardi/i, bg: '#b8a03e', ink: BLACK },
  { match: /evnroll/i, bg: '#8dc63f', ink: BLACK },
  { match: /\bsik\b/i, bg: '#3f3f45', ink: WHITE },
  { match: /swag/i, bg: '#111111', ink: '#d9b45b' },
  { match: /mizuno/i, bg: '#2d4f7c', ink: WHITE },
  { match: /wilson/i, bg: '#8c1c13', ink: WHITE },
  { match: /cleveland|srixon/i, bg: '#0f5c4c', ink: WHITE },
  { match: /axis\s?1|piretti|byron|olson/i, bg: '#6b7076', ink: WHITE },
];

export function brandPill(name: string): { bg: string; ink: string } | null {
  return BRAND_PILLS.find((b) => b.match.test(name)) ?? null;
}

export const FACTORS = ['lip', 'push', 'pull', 'decel', 'accel'] as const;
export type Factor = (typeof FACTORS)[number];

export const FACTOR_LABELS: Record<Factor, string> = {
  lip: 'Lipped',
  push: 'Pushed',
  pull: 'Pulled',
  decel: 'Decel',
  accel: 'Accel',
};

export const BREAK_DIRS: BreakDir[] = ['L→R', 'R→L', 'straight', 'uphill', 'downhill'];

/**
 * Labels put the letters where the sides actually are: L on the left, R on the right, with the
 * arrow showing which way the ball curves. The stored value keeps its old spelling so putts
 * already logged still read.
 */
/** 1 to 3, shown only once a slope is picked. */
export const SLOPE_STEPS = [1, 2, 3] as const;
export const SLOPE_LABELS: Record<number, string> = { 1: 'Slight', 2: 'Some', 3: 'Steep' };

export const BREAK_LABELS: Record<BreakDir, string> = {
  'L→R': 'L→R',
  'R→L': 'L←R',
  straight: 'Straight',
  uphill: 'Uphill',
  downhill: 'Downhill',
};

const SIDES: BreakDir[] = ['L→R', 'R→L'];
const SLOPES: BreakDir[] = ['uphill', 'downhill'];

/** What is tagged on a putt, taking the old single-value field into account. */
export function breakDirsOf(p: Putt): BreakDir[] {
  if (p.breakDirs) return p.breakDirs;
  return p.breakDir ? [p.breakDir] : [];
}

/**
 * Turning one chip on or off. Both sides together is a double breaker and is allowed, but
 * straight cancels a side, and a putt cannot run uphill and downhill at once.
 */
export function toggleBreak(current: BreakDir[], picked: BreakDir): BreakDir[] {
  if (current.includes(picked)) return current.filter((d) => d !== picked);
  let next = current;
  if (picked === 'straight') next = next.filter((d) => !SIDES.includes(d));
  if (SIDES.includes(picked)) next = next.filter((d) => d !== 'straight');
  if (SLOPES.includes(picked)) next = next.filter((d) => !SLOPES.includes(d));
  return [...next, picked];
}

export const BREAK_BUCKETS = ['lr', 'rl', 'double', 'straight'] as const;
export type BreakBucket = (typeof BREAK_BUCKETS)[number];

export const BREAK_BUCKET_LABELS: Record<BreakBucket, string> = {
  lr: 'L→R',
  rl: 'L←R',
  double: 'Double',
  straight: 'Straight',
};

/**
 * Which single bucket a putt belongs to. A double breaker is its own kind of putt rather than
 * half of each side, so every tagged putt lands in exactly one and the percentages stay honest.
 */
export function breakBucket(dirs: BreakDir[]): BreakBucket | null {
  const lr = dirs.includes('L→R');
  const rl = dirs.includes('R→L');
  if (lr && rl) return 'double';
  if (lr) return 'lr';
  if (rl) return 'rl';
  if (dirs.includes('straight')) return 'straight';
  return null;
}

/** Uphill and downhill are a separate axis from which way it breaks. */
export function slopeOf(dirs: BreakDir[]): 'uphill' | 'downhill' | null {
  if (dirs.includes('uphill')) return 'uphill';
  if (dirs.includes('downhill')) return 'downhill';
  return null;
}

/** "Double break · downhill", "L→R", "Straight · uphill". */
export function breakLabel(dirs: BreakDir[]): string {
  const sides = SIDES.filter((d) => dirs.includes(d));
  const side =
    sides.length === 2
      ? 'Double break'
      : sides.length === 1
        ? BREAK_LABELS[sides[0]]
        : dirs.includes('straight')
          ? 'Straight'
          : '';
  const slope = SLOPES.find((d) => dirs.includes(d)) ?? '';
  return [side, slope].filter(Boolean).join(' · ');
}
