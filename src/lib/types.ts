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
  /** Background for the putter pill. Letters are picked for contrast. */
  color?: string;
}

const WHITE = '#f7f5ee';
const BLACK = '#141414';

/** Each pill colour ships with the letter colour that reads best on it. */
export const PUTTER_PILLS: { bg: string; ink: string }[] = [
  { bg: '#1c1c1e', ink: WHITE },
  { bg: '#14392b', ink: WHITE },
  { bg: '#e07b22', ink: BLACK },
  { bg: '#a52a1f', ink: WHITE },
  { bg: '#2d4f7c', ink: WHITE },
  { bg: '#c9a227', ink: BLACK },
  { bg: '#b9bec2', ink: BLACK },
  { bg: '#f2efe6', ink: BLACK },
];

export const PUTTER_COLORS = PUTTER_PILLS.map((p) => p.bg);

export function inkOn(hex: string): string {
  const known = PUTTER_PILLS.find((p) => p.bg.toLowerCase() === hex.toLowerCase());
  if (known) return known.ink;
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.42 ? BLACK : WHITE;
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

export const DEFAULT_BASELINE: [number, number][] = [
  [1, 1.0], [2, 1.01], [3, 1.04], [4, 1.13], [5, 1.23], [6, 1.34], [7, 1.42],
  [8, 1.5], [9, 1.56], [10, 1.61], [12, 1.7], [15, 1.78], [20, 1.87],
  [25, 1.94], [30, 2.0], [35, 2.05], [40, 2.1], [50, 2.2], [60, 2.27],
];

export const FACTORS = ['lip', 'push', 'pull', 'chunk'] as const;
export type Factor = (typeof FACTORS)[number];

export const FACTOR_LABELS: Record<Factor, string> = {
  lip: 'Lipped',
  push: 'Pushed',
  pull: 'Pulled',
  chunk: 'Chunked',
};

export const BREAK_DIRS: BreakDir[] = ['L→R', 'R→L', 'straight', 'uphill', 'downhill'];
