import type { Action } from './store';
import { go } from './router';
import type { AppState, SessionDef, Surface } from './types';

/**
 * Sessions every player has from day one, so Practice never opens with nothing to start. Built
 * from the app's own drills, each fitted to your room when it runs.
 */
export const STARTERS: SessionDef[] = [
  {
    id: 'starter-tuneup',
    name: 'Ten-minute tune-up',
    source: 'mine',
    blocks: [
      { drill: 'run-3', minutes: 3 },
      { drill: 'ten-6', minutes: 3 },
      { drill: 'twelve', minutes: 4 },
    ],
  },
  {
    id: 'starter-short',
    name: 'Short putts',
    source: 'mine',
    blocks: [
      { drill: 'firm-3', minutes: 5 },
      { drill: 'mix-short', minutes: 5 },
      { drill: 'gate-6', minutes: 5 },
    ],
  },
  {
    id: 'starter-pace',
    name: 'Pace for long putts',
    source: 'mine',
    blocks: [
      { drill: 'twelve', minutes: 5 },
      { drill: 'same-time', minutes: 5 },
      { drill: 'back-edge', minutes: 5 },
    ],
  },
];

/**
 * What a coach can set as the week's practice, one per stretch of the green. Ids stay fixed: they
 * are stored on the team and on every set rolled inside them.
 */
export const FOCUS: (SessionDef & { band: FocusBand })[] = [
  {
    id: 'focus-short',
    band: 'short',
    name: 'Inside six feet',
    source: 'mine',
    blocks: [
      { drill: 'firm-3', minutes: 5 },
      { drill: 'clock-4', minutes: 5 },
      { drill: 'mix-short', minutes: 5 },
    ],
  },
  {
    id: 'focus-mid',
    band: 'mid',
    name: 'Six to ten feet',
    source: 'mine',
    blocks: [
      { drill: 'ten-6', minutes: 5 },
      { drill: 'ladder-6-10', minutes: 5 },
      { drill: 'mix-mid', minutes: 5 },
    ],
  },
  {
    id: 'focus-makeable',
    band: 'makeable',
    name: 'Eleven to twenty feet',
    source: 'mine',
    blocks: [
      { drill: 'twelve', minutes: 5 },
      { drill: 'mix-long', minutes: 5 },
      { drill: 'downhill-10', minutes: 5 },
    ],
  },
  {
    id: 'focus-lag',
    band: 'lag',
    name: 'Twenty to forty feet',
    source: 'mine',
    blocks: [
      { drill: 'twenty-thirty', minutes: 5 },
      { drill: 'two-putt-ladder', minutes: 5 },
      { drill: 'lag-ladder', minutes: 5 },
    ],
  },
  {
    id: 'focus-long',
    band: 'long',
    name: 'Over forty feet',
    source: 'mine',
    blocks: [
      { drill: 'back-edge', minutes: 5 },
      { drill: 'same-time', minutes: 5 },
      { drill: 'lag-ladder', minutes: 5 },
    ],
  },
];

export type FocusBand = 'short' | 'mid' | 'makeable' | 'lag' | 'long';

export const findFocus = (id: string | null | undefined) => FOCUS.find((f) => f.id === id);

export const isStarter = (id: string) => STARTERS.some((s) => s.id === id) || FOCUS.some((s) => s.id === id);

/** Set by a Start button so the session opens straight onto its first drill. Start means start. */
const OPEN_FIRST = 'break.openFirst';

/** Read without clearing: a render may run twice. The session page clears it once mounted. */
export function opensFirst(id: string): boolean {
  try {
    return sessionStorage.getItem(OPEN_FIRST) === id;
  } catch {
    return false;
  }
}

export function clearOpenFirst() {
  try {
    sessionStorage.removeItem(OPEN_FIRST);
  } catch {
    // Nothing was stored.
  }
}

/** One tap: save the session if it is a starter you have not run, start it, open its first drill. */
export function startSession(
  state: Pick<AppState, 'sessions' | 'run'>,
  dispatch: (a: Action) => void,
  session: SessionDef,
  surface: Surface,
) {
  if (!state.sessions.some((s) => s.id === session.id)) dispatch({ t: 'saveSession', session });
  if (state.run?.session !== session.id) {
    dispatch({ t: 'startRun', session: session.id, surface });
    try {
      sessionStorage.setItem(OPEN_FIRST, session.id);
    } catch {
      // Private mode: the session page opens and the first drill is one more tap.
    }
  }
  go(`/practice/session/${session.id}`);
}
