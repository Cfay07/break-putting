export type MissSide = 'high' | 'low' | 'online';
export type Speed = 'short' | 'good' | 'long';
export type BreakDir = 'L→R' | 'R→L' | 'straight' | 'uphill' | 'downhill';

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
  greens?: number;
  recordedPutts?: number;
  /** Named nines, for courses with more than eighteen holes. First is holes 1-9. */
  firstNine?: string;
  secondNine?: string;
  courseId?: string;
  tee?: string;
  /** When this round last changed, so two devices can merge by taking the newer copy. */
  updated?: string;
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
  kind: 'round' | 'putter';
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
  /** Hides the running score and the bleed drop while playing, for tournament rounds. */
  quietTrack?: boolean;
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

export const FACTORS = ['lip', 'push', 'pull'] as const;
export type Factor = (typeof FACTORS)[number];

export const FACTOR_LABELS: Record<Factor, string> = {
  lip: 'Lipped',
  push: 'Pushed',
  pull: 'Pulled',
};

export const BREAK_DIRS: BreakDir[] = ['L→R', 'R→L', 'straight', 'uphill', 'downhill'];

/**
 * Labels put the letters where the sides actually are: L on the left, R on the right, with the
 * arrow showing which way the ball curves. The stored value keeps its old spelling so putts
 * already logged still read.
 */
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
