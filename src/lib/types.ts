export type MissSide = 'high' | 'low' | 'online';
export type Speed = 'short' | 'good' | 'long';
export type BreakDir = 'L→R' | 'R→L' | 'straight' | 'uphill' | 'downhill';

export interface Putt {
  d: number;
  made: boolean;
  missSide?: MissSide;
  speed?: Speed;
  breakDir?: BreakDir;
  lip?: boolean;
  push?: boolean;
  pull?: boolean;
  chunk?: boolean;
}

export interface Hole {
  hole: number;
  putts: Putt[];
  par?: number;
  strokes?: number;
  /** Set directly by the importer, which only ever sees a running score. */
  vsPar?: number;
}

/** What the hole cost against par, however it was recorded. */
export function holeVsPar(h: Hole): number | undefined {
  if (h.par !== undefined && h.strokes !== undefined) return h.strokes - h.par;
  return h.vsPar;
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

export const FACTORS = ['lip', 'push', 'pull', 'chunk'] as const;
export type Factor = (typeof FACTORS)[number];

export const FACTOR_LABELS: Record<Factor, string> = {
  lip: 'Lipped',
  push: 'Pushed',
  pull: 'Pulled',
  chunk: 'Chunked',
};

export const BREAK_DIRS: BreakDir[] = ['L→R', 'R→L', 'straight', 'uphill', 'downhill'];
