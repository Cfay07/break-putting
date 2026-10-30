import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { clearStored, emptyState, load, newId, save } from './storage';
import type { Incoming } from './sync';
import { holedOut } from './types';
import type {
  AppState,
  DrillDef,
  Hole,
  PracticeSet,
  Putt,
  Round,
  SavedCourse,
  SessionDef,
  Surface,
  TrackUI,
} from './types';
import { DEFAULT_ROOM } from './types';

const now = () => new Date().toISOString();

export type Action =
  | { t: 'addPutter'; id: string; name: string }
  | { t: 'renamePutter'; id: string; name: string }
  | { t: 'setActivePutter'; id: string }
  | { t: 'retirePutter'; id: string; retired: boolean }
  | { t: 'deletePutter'; id: string; moveTo?: string }
  | { t: 'saveCourse'; course: SavedCourse }
  | { t: 'deleteCourse'; id: string }
  | { t: 'newRound'; round: Round }
  | { t: 'addPutt'; putt: Putt }
  | { t: 'insertPutt'; roundId: string; hole: number; putt: Putt }
  | { t: 'removePutt'; roundId: string; hole: number; index: number }
  | { t: 'updatePutt'; roundId: string; hole: number; index: number; patch: Partial<Putt> }
  | { t: 'setHoleScore'; roundId: string; hole: number; patch: Partial<Pick<Hole, 'par' | 'strokes' | 'vsPar' | 'holedOut'>> }
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
  | { t: 'setQuietTrack'; on: boolean }
  | { t: 'addPracticeSet'; set: PracticeSet }
  | { t: 'deletePracticeSet'; id: string }
  | { t: 'deletePracticeSets'; ids: string[] }
  | { t: 'saveDrill'; drill: DrillDef }
  | { t: 'deleteDrill'; id: string }
  | { t: 'saveSession'; session: SessionDef }
  | { t: 'deleteSession'; id: string }
  | { t: 'importPractice'; drills: DrillDef[]; sessions: SessionDef[] }
  | { t: 'setRoom'; surface: Surface; feet: number }
  | { t: 'startRun'; session: string; surface: Surface }
  | { t: 'finishBlock'; block: number; setId: string }
  | { t: 'goToBlock'; block: number }
  | { t: 'endRun' }
  | { t: 'setSurface'; surface: Surface }
  | { t: 'replaceState'; state: AppState }
  | { t: 'mergeState'; state: AppState }
  | { t: 'updateFromFile'; state: AppState }
  | { t: 'applyIncoming'; incoming: Incoming }
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

/** The round being logged, real or practice. Only one can be going at a time. */
export function liveRound(state: AppState): Round | undefined {
  return state.rounds.find((r) => !r.finished) ?? (state.practiceRounds ?? []).find((r) => !r.finished);
}

/** A round by id from either list, for the screens that show both kinds the same way. */
export function findRound(state: AppState, id: string): Round | undefined {
  return state.rounds.find((r) => r.id === id) ?? (state.practiceRounds ?? []).find((r) => r.id === id);
}

/** Practice records carry real ids, so a backup and this device agree on what is the same one. */
function unionById<T extends { id: string }>(mine: T[], theirs: T[]): T[] {
  const have = new Set(mine.map((s) => s.id));
  return [...mine, ...theirs.filter((s) => !have.has(s.id))];
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
}

/** Newer copy wins, and a local deletion outranks any copy older than it. */
function mergeIncoming<T extends { id: string; updated?: string }>(
  mine: T[],
  incoming: T[],
  graves: Map<string, string>,
  removed: string[],
): T[] {
  const byId = new Map(mine.map((x) => [x.id, x]));
  for (const x of incoming) {
    const grave = graves.get(x.id);
    if (grave !== undefined && grave >= (x.updated ?? '')) continue;
    const have = byId.get(x.id);
    if (!have || (have.updated ?? '') < (x.updated ?? '')) byId.set(x.id, x);
  }
  for (const id of removed) byId.delete(id);
  return [...byId.values()];
}

function bury(state: AppState, id: string): AppState['tombstones'] {
  return [...state.tombstones.filter((t) => t.id !== id), { id, kind: 'practice' as const, at: now() }];
}

const freshTrack: TrackUI = { hole: 1, phase: 'distance', distanceInput: '', draft: null };

function mapRound(state: AppState, id: string, fn: (r: Round) => Round): AppState {
  const touch = (r: Round) => (r.id === id ? { ...fn(r), updated: now() } : r);
  if (state.practiceRounds?.some((r) => r.id === id)) {
    return { ...state, practiceRounds: state.practiceRounds.map(touch) };
  }
  return { ...state, rounds: state.rounds.map(touch) };
}

export function reducer(state: AppState, a: Action): AppState {
  switch (a.t) {
    case 'addPutter': {
      const first = state.putters.filter((p) => !p.retired).length === 0;
      const putter = { id: a.id, name: a.name.trim(), active: first, retired: false, updated: now() };
      return { ...state, putters: [...state.putters, putter] };
    }
    case 'renamePutter':
      return {
        ...state,
        putters: state.putters.map((p) =>
          p.id === a.id ? { ...p, name: a.name.trim(), updated: now() } : p,
        ),
      };
    case 'setActivePutter':
      return {
        ...state,
        putters: state.putters.map((p) => ({ ...p, active: p.id === a.id, updated: now() })),
      };
    case 'retirePutter':
      return {
        ...state,
        putters: state.putters.map((p) =>
          p.id === a.id
            ? { ...p, retired: a.retired, active: a.retired ? false : p.active, updated: now() }
            : p,
        ),
      };
    case 'deletePutter': {
      // Its rounds and sets move to the putter you picked, so deleting a putter never deletes putting.
      const at = now();
      const move = a.moveTo;
      const rest = state.putters.filter((p) => p.id !== a.id);
      const wasActive = state.putters.find((p) => p.id === a.id)?.active;
      const heir = move ?? rest.find((p) => !p.retired)?.id;
      return {
        ...state,
        putters: wasActive && heir ? rest.map((p) => ({ ...p, active: p.id === heir, updated: at })) : rest,
        rounds: move
          ? state.rounds.map((r) => (r.putterId === a.id ? { ...r, putterId: move, updated: at } : r))
          : state.rounds,
        practice: move
          ? state.practice.map((x) => (x.putterId === a.id ? { ...x, putterId: move, updated: at } : x))
          : state.practice,
        tombstones: [...state.tombstones.filter((t) => t.id !== a.id), { id: a.id, kind: 'putter' as const, at }],
      };
    }

    case 'saveCourse':
      return {
        ...state,
        courses: [a.course, ...state.courses.filter((c) => c.id !== a.course.id)],
        settingsUpdated: now(),
      };

    case 'deleteCourse':
      return {
        ...state,
        courses: state.courses.filter((c) => c.id !== a.id),
        settingsUpdated: now(),
      };

    case 'newRound':
      if (a.round.practice) {
        return {
          ...state,
          practiceRounds: [{ ...a.round, updated: now() }, ...(state.practiceRounds ?? [])],
          track: freshTrack,
        };
      }
      return {
        ...state,
        rounds: [{ ...a.round, updated: now() }, ...state.rounds],
        track: freshTrack,
      };

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

    /** addPutt only ever touches the live round's current hole. Editing a finished one needs this. */
    case 'insertPutt':
      return mapRound(state, a.roundId, (r) => ({
        ...r,
        holes: r.holes.map((hole) =>
          hole.hole === a.hole
            ? {
                ...hole,
                // You cannot hole out and then putt again, so adding one after a holed putt
                // means that putt actually missed.
                putts: [...hole.putts.map((p) => (p.made ? { ...p, made: false } : p)), a.putt],
              }
            : hole,
        ),
      }));

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
                putts: hole.putts.map((p, i) =>
                  i === a.index
                    ? { ...p, ...a.patch }
                    : // At most one putt a hole goes in. Without this, marking an earlier one
                      // holed left two makes on the hole and the make rate counted both.
                      a.patch.made === true && p.made
                      ? { ...p, made: false }
                      : p,
                ),
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
      // Undoing a chip-in clears the flag, otherwise it would strip a putt off an earlier hole.
      if (target && holedOut(target)) {
        const hole = target.hole;
        return mapRound(state, live.id, (r) => ({
          ...r,
          holes: r.holes.map((x) => (x.hole === hole ? { ...x, holedOut: false } : x)),
        }));
      }
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
      const practice = (state.practiceRounds ?? []).find((r) => r.id === a.id);
      if (practice) {
        return {
          ...state,
          practiceRounds: state.practiceRounds.filter((r) => r.id !== a.id),
          tombstones: bury(state, a.id),
          track: practice.finished ? state.track : freshTrack,
        };
      }
      const wasLive = state.rounds.find((r) => r.id === a.id && !r.finished);
      return {
        ...state,
        rounds: state.rounds.filter((r) => r.id !== a.id),
        tombstones: [
          ...state.tombstones.filter((t) => t.id !== a.id),
          { id: a.id, kind: 'round' as const, at: now() },
        ],
        track: wasLive ? freshTrack : state.track,
      };
    }

    case 'setQuietTrack':
      return { ...state, quietTrack: a.on };

    case 'addPracticeSet':
      return { ...state, practice: [...state.practice, { ...a.set, updated: now() }] };

    case 'deletePracticeSet':
      return { ...state, practice: state.practice.filter((s) => s.id !== a.id), tombstones: bury(state, a.id) };

    case 'deletePracticeSets': {
      const gone = new Set(a.ids);
      const at = now();
      return {
        ...state,
        practice: state.practice.filter((s) => !gone.has(s.id)),
        tombstones: [
          ...state.tombstones.filter((t) => !gone.has(t.id)),
          ...a.ids.map((id) => ({ id, kind: 'practice' as const, at })),
        ],
      };
    }

    case 'saveDrill':
      return { ...state, drills: upsert(state.drills, { ...a.drill, updated: now() }) };

    case 'deleteDrill':
      return { ...state, drills: state.drills.filter((d) => d.id !== a.id), tombstones: bury(state, a.id) };

    case 'saveSession':
      return { ...state, sessions: upsert(state.sessions, { ...a.session, updated: now() }) };

    case 'deleteSession':
      return {
        ...state,
        sessions: state.sessions.filter((x) => x.id !== a.id),
        tombstones: bury(state, a.id),
        run: state.run?.session === a.id ? undefined : state.run,
      };

    case 'importPractice': {
      const at = now();
      return {
        ...state,
        drills: [...state.drills, ...a.drills.map((d) => ({ ...d, updated: at }))],
        sessions: [...state.sessions, ...a.sessions.map((x) => ({ ...x, updated: at }))],
      };
    }

    case 'setRoom':
      return {
        ...state,
        room: { ...DEFAULT_ROOM, ...state.room, [a.surface]: a.feet },
        settingsUpdated: now(),
      };

    case 'startRun': {
      const at = now();
      return {
        ...state,
        run: { session: a.session, surface: a.surface, startedAt: at, block: 0, blockStartedAt: at, done: {} },
      };
    }

    case 'finishBlock': {
      if (!state.run) return state;
      const done = { ...state.run.done, [a.block]: a.setId };
      // Rolling a finished block again replaces its set and leaves you where you are.
      if (state.run.done[a.block] !== undefined) return { ...state, run: { ...state.run, done } };
      const blocks = state.sessions.find((x) => x.id === state.run!.session)?.blocks.length ?? 0;
      let next = a.block + 1;
      while (next < blocks && done[next]) next++;
      return {
        ...state,
        run: { ...state.run, done, block: Math.min(next, blocks), blockStartedAt: now() },
      };
    }

    case 'goToBlock':
      return state.run ? { ...state, run: { ...state.run, block: a.block, blockStartedAt: now() } } : state;

    case 'endRun':
      return { ...state, run: undefined };

    case 'setSurface':
      return { ...state, surface: a.surface };

    case 'setBaseline':
      return { ...state, baseline: a.baseline, settingsUpdated: now() };

    case 'mergeState': {
      const newPutters = a.state.putters.filter((p) => !state.putters.some((x) => x.id === p.id));
      const newCourses = (a.state.courses ?? []).filter(
        (c) => !state.courses.some((x) => x.id === c.id),
      );
      // Same day and same number of holes is the same round, whatever id it arrived with.
      const newRounds = a.state.rounds.filter(
        (r) =>
          !state.rounds.some(
            (x) => x.id === r.id || (x.date === r.date && x.holeCount === r.holeCount),
          ),
      );
      return {
        ...state,
        putters: [...state.putters, ...newPutters],
        courses: [...state.courses, ...newCourses],
        rounds: [...newRounds, ...state.rounds],
        practice: unionById(state.practice, a.state.practice ?? []),
        drills: unionById(state.drills, a.state.drills ?? []),
        sessions: unionById(state.sessions, a.state.sessions ?? []),
        practiceRounds: unionById(state.practiceRounds ?? [], a.state.practiceRounds ?? []),
      };
    }

    case 'updateFromFile': {
      // Matches on id, or failing that on the same date and hole count, so a corrected copy of a
      // round replaces the old one while anything the file has never heard of is left alone.
      const key = (r: Round) => `${r.date}|${r.holeCount}`;
      const incomingKeys = new Set(a.state.rounds.map(key));
      const incomingIds = new Set(a.state.rounds.map((r) => r.id));
      const kept = state.rounds.filter((r) => !incomingIds.has(r.id) && !incomingKeys.has(key(r)));
      const putterIds = new Set(state.putters.map((p) => p.id));
      return {
        ...state,
        rounds: [...a.state.rounds, ...kept],
        putters: [
          ...state.putters,
          ...a.state.putters.filter((p) => !putterIds.has(p.id)),
        ],
        practice: unionById(state.practice, a.state.practice ?? []),
        drills: unionById(state.drills, a.state.drills ?? []),
        sessions: unionById(state.sessions, a.state.sessions ?? []),
        practiceRounds: unionById(state.practiceRounds ?? [], a.state.practiceRounds ?? []),
      };
    }

    case 'applyIncoming': {
      const {
        rounds,
        putters,
        removed,
        settings,
        practice = [],
        drills = [],
        sessions = [],
        practiceRounds = [],
        practiceRemoved = [],
      } = a.incoming;

      // Whichever copy changed last wins, so a phone that was offline mid-round is not
      // overwritten by an older copy sitting on another device.
      const byId = new Map(state.rounds.map((r) => [r.id, r]));
      // A local tombstone outranks any copy of the round that is older than the deletion.
      // Without this a pull quietly resurrects whatever you just deleted, which is exactly
      // what another device re-uploading a stale copy will hand back.
      const graves = new Map(state.tombstones.map((t) => [t.id, t.at]));
      for (const incoming of rounds) {
        const grave = graves.get(incoming.id);
        if (grave !== undefined && grave >= (incoming.updated ?? '')) continue;
        const mine = byId.get(incoming.id);
        if (!mine || (mine.updated ?? '') < (incoming.updated ?? '')) byId.set(incoming.id, incoming);
      }
      for (const id of removed) byId.delete(id);

      const putterById = new Map(state.putters.map((p) => [p.id, p]));
      for (const incoming of putters) {
        const grave = graves.get(incoming.id);
        if (grave !== undefined && grave >= (incoming.updated ?? '')) continue;
        const mine = putterById.get(incoming.id);
        if (!mine || (mine.updated ?? '') < (incoming.updated ?? '')) putterById.set(incoming.id, incoming);
      }
      for (const id of a.incoming.puttersRemoved ?? []) putterById.delete(id);

      const takeSettings = settings && (state.settingsUpdated ?? '') < settings.updated;

      return {
        ...state,
        rounds: [...byId.values()],
        putters: [...putterById.values()],
        practice: mergeIncoming(state.practice, practice, graves, practiceRemoved),
        drills: mergeIncoming(state.drills, drills, graves, practiceRemoved),
        sessions: mergeIncoming(state.sessions, sessions, graves, practiceRemoved),
        practiceRounds: mergeIncoming(state.practiceRounds ?? [], practiceRounds, graves, practiceRemoved),
        baseline: takeSettings && settings.baseline.length ? settings.baseline : state.baseline,
        courses: takeSettings ? settings.courses : state.courses,
        room: takeSettings && settings.room ? { ...DEFAULT_ROOM, ...settings.room } : state.room,
        settingsUpdated: takeSettings ? settings.updated : state.settingsUpdated,
      };
    }

    case 'replaceState':
      return {
        ...a.state,
        practice: a.state.practice ?? [],
        drills: a.state.drills ?? [],
        sessions: a.state.sessions ?? [],
        practiceRounds: a.state.practiceRounds ?? [],
        room: { ...DEFAULT_ROOM, ...a.state.room },
        track: freshTrack,
      };

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
