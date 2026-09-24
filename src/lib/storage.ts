import { DEFAULT_BASELINE, type AppState } from './types';

const KEY = 'break.state';
const OWNER_KEY = 'break.owner';
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
    tombstones: [],
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

/**
 * Which account the rounds sitting in this browser belong to. Kept deliberately across sign
 * out: it is the only thing that can tell a second account signing in on the same phone that
 * the rounds it found are somebody else's. Null means nobody has claimed them yet.
 */
export function storedOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function claimStored(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // an unclaimed device just gets asked again at the next sign in
  }
}

export function clearStored(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}
