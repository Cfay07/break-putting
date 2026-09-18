import { DEFAULT_BASELINE, type AppState } from './types';

const KEY = 'break.state';
export const STATE_VERSION = 1;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    putters: [],
    courses: [],
    rounds: [],
    baseline: DEFAULT_BASELINE,
    track: { hole: 1, phase: 'distance', distanceInput: '', draft: null },
  };
}

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...emptyState(), ...parsed, version: STATE_VERSION };
  } catch {
    return emptyState();
  }
}

export function save(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked; keep the session running in memory
  }
}

export function clearStored(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}
