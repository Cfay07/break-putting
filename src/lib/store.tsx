import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { clearStored, emptyState, load, newId, save } from './storage';
import type { AppState, Hole, Putt, Round, SavedCourse, TrackUI } from './types';

export type Action =
  | { t: 'addPutter'; id: string; name: string }
  | { t: 'renamePutter'; id: string; name: string }
  | { t: 'setActivePutter'; id: string }
  | { t: 'retirePutter'; id: string; retired: boolean }
  | { t: 'saveCourse'; course: SavedCourse }
  | { t: 'deleteCourse'; id: string }
  | { t: 'newRound'; round: Round }
  | { t: 'addPutt'; putt: Putt }
  | { t: 'removePutt'; roundId: string; hole: number; index: number }
  | { t: 'updatePutt'; roundId: string; hole: number; index: number; patch: Partial<Putt> }
  | { t: 'setHoleScore'; roundId: string; hole: number; patch: Partial<Pick<Hole, 'par' | 'strokes' | 'vsPar'>> }
  | {
      t: 'applyCourse';
      roundId: string;
      course: string;
      courseId?: string;
      tee?: string;
      pars?: number[];
    }
  | { t: 'undoLast' }
  | { t: 'setTrack'; patch: Partial<TrackUI> }
  | { t: 'finishRound' }
  | { t: 'updateRound'; id: string; patch: Partial<Round> }
  | { t: 'deleteRound'; id: string }
  | { t: 'setBaseline'; baseline: [number, number][] }
  | { t: 'replaceState'; state: AppState }
  | { t: 'mergeState'; state: AppState }
  | { t: 'clearAll' };

export function blankHoles(count: number): Hole[] {
  return Array.from({ length: count }, (_, i) => ({ hole: i + 1, putts: [] }));
}

export function makeRound(fields: {
  date: string;
  course?: string;
  putterId: string;
  holeCount: number;
  pars?: number[];
}): Round {
  return {
    id: newId(),
    label: fields.course?.trim() || fields.date,
    date: fields.date,
    course: fields.course?.trim() || undefined,
    putterId: fields.putterId,
    holeCount: fields.holeCount,
    holes: blankHoles(fields.holeCount).map((h, i) =>
      fields.pars?.[i] ? { ...h, par: fields.pars[i] } : h,
    ),
    finished: false,
  };
}

export function liveRound(state: AppState): Round | undefined {
  return state.rounds.find((r) => !r.finished);
}

const freshTrack: TrackUI = { hole: 1, phase: 'distance', distanceInput: '', draft: null };

function mapRound(state: AppState, id: string, fn: (r: Round) => Round): AppState {
  return { ...state, rounds: state.rounds.map((r) => (r.id === id ? fn(r) : r)) };
}

export function reducer(state: AppState, a: Action): AppState {
  switch (a.t) {
    case 'addPutter': {
      const first = state.putters.filter((p) => !p.retired).length === 0;
      const putter = { id: a.id, name: a.name.trim(), active: first, retired: false };
      return { ...state, putters: [...state.putters, putter] };
    }
    case 'renamePutter':
      return {
        ...state,
        putters: state.putters.map((p) => (p.id === a.id ? { ...p, name: a.name.trim() } : p)),
      };
    case 'setActivePutter':
      return {
        ...state,
        putters: state.putters.map((p) => ({ ...p, active: p.id === a.id })),
      };
    case 'retirePutter':
      return {
        ...state,
        putters: state.putters.map((p) =>
          p.id === a.id ? { ...p, retired: a.retired, active: a.retired ? false : p.active } : p,
        ),
      };
    case 'saveCourse':
      return {
        ...state,
        courses: [a.course, ...state.courses.filter((c) => c.id !== a.course.id)],
      };

    case 'deleteCourse':
      return { ...state, courses: state.courses.filter((c) => c.id !== a.id) };

    case 'newRound':
      return { ...state, rounds: [a.round, ...state.rounds], track: freshTrack };

    case 'addPutt': {
      const live = liveRound(state);
      if (!live) return state;
      const h = state.track.hole;
      const next = mapRound(state, live.id, (r) => ({
        ...r,
        holes: r.holes.map((hole) =>
          hole.hole === h ? { ...hole, putts: [...hole.putts, a.putt] } : hole,
        ),
      }));
      return { ...next, track: { ...freshTrack, hole: h } };
    }

    case 'removePutt':
      return mapRound(state, a.roundId, (r) => ({
        ...r,
        holes: r.holes.map((hole) =>
          hole.hole === a.hole
            ? { ...hole, putts: hole.putts.filter((_, i) => i !== a.index) }
            : hole,
        ),
      }));

    case 'updatePutt':
      return mapRound(state, a.roundId, (r) => ({
        ...r,
        holes: r.holes.map((hole) =>
          hole.hole === a.hole
            ? {
                ...hole,
                putts: hole.putts.map((p, i) => (i === a.index ? { ...p, ...a.patch } : p)),
              }
            : hole,
        ),
      }));

    case 'applyCourse': {
      const nines = a.tee?.includes('/') ? a.tee.split('/').map((n) => n.trim()) : null;
      return mapRound(state, a.roundId, (r) => ({
        ...r,
        course: a.course,
        label: a.course || r.label,
        courseId: a.courseId,
        tee: a.tee,
        firstNine: r.firstNine ?? (nines ? nines[0] : undefined),
        secondNine: r.secondNine ?? (r.holeCount > 9 && nines ? nines[1] : undefined),
        holes: r.holes.map((h, i) => (a.pars?.[i] ? { ...h, par: a.pars[i] } : h)),
      }));
    }

    case 'setHoleScore':
      return mapRound(state, a.roundId, (r) => ({
        ...r,
        holes: r.holes.map((hole) => (hole.hole === a.hole ? { ...hole, ...a.patch } : hole)),
      }));

    case 'undoLast': {
      const live = liveRound(state);
      if (!live) return state;
      if (state.track.phase === 'tags' || state.track.distanceInput) {
        return { ...state, track: { ...state.track, phase: 'distance', distanceInput: '', draft: null } };
      }
      let target = live.holes.find((h) => h.hole === state.track.hole);
      if (!target || !target.putts.length) {
        const played = live.holes.filter((h) => h.putts.length);
        target = played[played.length - 1];
      }
      if (!target) return state;
      const hole = target.hole;
      const next = mapRound(state, live.id, (r) => ({
        ...r,
        holes: r.holes.map((x) => (x.hole === hole ? { ...x, putts: x.putts.slice(0, -1) } : x)),
      }));
      return { ...next, track: { ...freshTrack, hole } };
    }

    case 'setTrack':
      return { ...state, track: { ...state.track, ...a.patch } };

    case 'finishRound': {
      const live = liveRound(state);
      if (!live) return state;
      return { ...mapRound(state, live.id, (r) => ({ ...r, finished: true })), track: freshTrack };
    }

    case 'updateRound':
      return mapRound(state, a.id, (r) => {
        const merged = { ...r, ...a.patch };
        return { ...merged, label: merged.course?.trim() || merged.date };
      });

    case 'deleteRound': {
      const wasLive = state.rounds.find((r) => r.id === a.id && !r.finished);
      return {
        ...state,
        rounds: state.rounds.filter((r) => r.id !== a.id),
        track: wasLive ? freshTrack : state.track,
      };
    }

    case 'setBaseline':
      return { ...state, baseline: a.baseline };

    case 'mergeState': {
      const newPutters = a.state.putters.filter((p) => !state.putters.some((x) => x.id === p.id));
      const newCourses = (a.state.courses ?? []).filter(
        (c) => !state.courses.some((x) => x.id === c.id),
      );
      const newRounds = a.state.rounds.filter((r) => !state.rounds.some((x) => x.id === r.id));
      return {
        ...state,
        putters: [...state.putters, ...newPutters],
        courses: [...state.courses, ...newCourses],
        rounds: [...newRounds, ...state.rounds],
      };
    }

    case 'replaceState':
      return { ...a.state, track: freshTrack };

    case 'clearAll':
      clearStored();
      return emptyState();
  }
}

interface Ctx {
  state: AppState;
  dispatch: (a: Action) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => save(state), [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}

export function putterName(state: AppState, id: string): string {
  return state.putters.find((p) => p.id === id)?.name ?? 'Unknown putter';
}
