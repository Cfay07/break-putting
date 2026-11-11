import { useEffect, useState } from 'react';
import { loadTempo, saveTempo, startTempo } from '../lib/tempo';
import { ASK_AGAIN_AFTER, LEVEL_STEP, levels, markOf, readyToMove, setsAt, withLevel } from '../lib/levels';
import { candidates, pickStroke, TUNE_DRILL, tuneArms, tuneVerdict } from '../lib/tempoTune';
import { distanceText, familyOf, scoringLabel, type Fitted } from '../lib/drills';
import { today } from '../lib/format';
import { historyOf, type DrillHistory } from '../lib/practice';
import { setScore, verdict } from '../lib/practiceView';
import { newId } from '../lib/storage';
import { useApp } from '../lib/store';
import { DEFAULT_ROOM, type PracticeSet, type Surface } from '../lib/types';
import { CountLogger } from './CountLogger';
import { GameLogger } from './GameLogger';
import { LadderLogger } from './LadderLogger';
import { StreakLogger } from './StreakLogger';

export type SetResult = Omit<PracticeSet, 'id' | 'date' | 'drill' | 'surface' | 'putterId' | 'session' | 'updated' | 'kind'>;

export interface LoggerProps {
  drill: Fitted;
  history: DrillHistory | null;
  /** The balls, when they were counted one at a time, so the result can show them. */
  onSave: (r: SetResult, balls?: boolean[]) => void;
}

function DoneLogger({ drill, onSave }: LoggerProps) {
  return (
    <div className="runner-body">
      <p className="small muted">{drill.how}</p>
      <div className="runner-btns">
        <button className="runner-no" onClick={() => onSave({ made: 0, attempts: 0, finished: false })}>
          Not finished
        </button>
        <button className="runner-yes" onClick={() => onSave({ made: 0, attempts: 0, finished: true })}>
          Done
        </button>
      </div>
    </div>
  );
}

const LOGGERS = { count: CountLogger, ladder: LadderLogger, streak: StreakLogger, game: GameLogger, done: DoneLogger };

/**
 * The full-screen counter for any drill, and the result after it. Used one-handed standing over
 * a ball, so it takes the whole screen and the two buttons that matter take the bottom of it.
 */
export function DrillLogger({
  drill: given,
  surface,
  session,
  next,
  onNext,
  onSaved,
  onClose,
  once,
}: {
  drill: Fitted;
  surface: Surface;
  session?: string;
  /** In a session, what the primary button moves on to, and what it does. */
  next?: string;
  onNext?: () => void;
  onSaved?: (set: PracticeSet) => void;
  onClose: () => void;
  /** A test is taken once: no going again for a better number. */
  once?: boolean;
}) {
  const { state, dispatch } = useApp();
  const family = (id: string) => familyOf(state, id);
  // Rolled at the distance you agreed to move back to, never past your room.
  const room = { ...DEFAULT_ROOM, ...state.room }[surface];
  const level = state.levels?.[family(given.id)];
  const drill = withLevel(given, level, room);
  const levelled = levels(drill);
  const here = levelled ? drill.stations[0].d : 0;
  const scoresHere = (sets: PracticeSet[]) => (levelled ? setsAt(sets, family(drill.id), family, here).map((s) => s.made) : []);
  const mark = levelled ? markOf(scoresHere(state.practice)) : null;
  const [ask, setAsk] = useState(false);
  // Taken when the set starts, so the comparison is with what came before it.
  const [before, setBefore] = useState(() => historyOf(state.practice, family(drill.id), family));
  const [saved, setSaved] = useState<{ set: PracticeSet; balls?: boolean[] } | null>(null);
  const [round, setRound] = useState(0);
  const Logger = LOGGERS[drill.scoring];
  // The metronome can run under any drill. A tempo drill starts with it on.
  const [beat, setBeat] = useState(() => !!drill.beat);
  const [tempo] = useState(loadTempo);
  // The tempo drill tunes itself blind: each set plays your speed or one either side, unseen.
  const tuning = family(drill.id) === TUNE_DRILL;
  const pick = (sets = state.practice) => (tuning ? pickStroke(tuneArms(sets, tempo.stroke, family)) : tempo.stroke);
  const [stroke, setStroke] = useState(() => pick());
  const [moved, setMoved] = useState<number | null>(null);
  useEffect(() => {
    if (!beat || saved) return;
    return startTempo({ ...tempo, stroke, sound: tempo.sound || !tempo.buzz }, () => {});
  }, [beat, saved, tempo, stroke]);

  const save = (r: SetResult, balls?: boolean[]) => {
    const set: PracticeSet = {
      id: newId(),
      date: today(),
      drill: drill.id,
      surface,
      putterId: state.putters.find((p) => p.active)?.id,
      ...(session ? { session } : {}),
      ...(beat ? { tempo: stroke } : {}),
      ...r,
    };
    dispatch({ t: 'addPracticeSet', set });
    if (tuning && beat) {
      const { winner } = tuneVerdict(tuneArms([...state.practice, set], tempo.stroke, family));
      const center = candidates(tempo.stroke)[1] ?? tempo.stroke;
      if (winner !== null && Math.abs(winner - center) > 0.001) {
        saveTempo({ ...loadTempo(), stroke: winner });
        setMoved(winner);
      }
    }
    setAsk(levelled && here + LEVEL_STEP <= room && readyToMove(scoresHere([...state.practice, set]), level));
    setSaved({ set, balls });
    onSaved?.(set);
  };

  const answer = (moveBack: boolean) => {
    const done = scoresHere(state.practice).length;
    dispatch({
      t: 'setLevel',
      drill: family(drill.id),
      ft: (level?.ft ?? 0) + (moveBack ? LEVEL_STEP : 0),
      ...(moveBack ? {} : { askAfter: done + ASK_AGAIN_AFTER }),
    });
    setAsk(false);
  };

  const again = () => {
    if (saved && drill.scoring !== 'game') {
      setBefore((h) => {
        const sets = [...(h?.sets ?? []), saved.set];
        return historyOf(sets, family(drill.id), family);
      });
    }
    setSaved(null);
    setMoved(null);
    setAsk(false);
    setStroke(pick(saved ? [...state.practice.filter((s) => s.id !== saved.set.id), saved.set] : state.practice));
    setRound((n) => n + 1);
  };

  return (
    <div className="runner" role="dialog" aria-modal="true" aria-label={drill.name}>
      <div className="runner-top">
        <div>
          <h3 style={{ margin: 0 }}>{drill.name}</h3>
          <span className="tiny">
            {[distanceText(drill), scoringLabel(drill)].filter(Boolean).join(' · ')}
          </span>
        </div>
        <span className="runner-top-end">
          {!saved && drill.scoring !== 'game' && drill.scoring !== 'done' && (
            <button className={beat ? 'beat-chip on' : 'beat-chip'} aria-pressed={beat} onClick={() => setBeat(!beat)}>
              {beat ? (tuning ? 'Beat on' : `Beat ${tempo.stroke.toFixed(2)} s`) : 'Beat'}
            </button>
          )}
          <button className="linkish tiny" onClick={onClose}>
            {saved ? 'Done' : 'Close'}
          </button>
        </span>
      </div>

      {levelled && !saved && (
        <p className="runner-mark">
          {mark !== null
            ? `Your mark here: ${mark} of ${drill.stations.reduce((n, st) => n + st.balls, 0)}. You reach it about two sets in three.`
            : 'Three sets from here and you get a mark you reach about two sets in three.'}
        </p>
      )}
      {saved ? (
        <div className="runner-body">
          <div className="runner-result">{setScore(drill, saved.set)}</div>
          {drill.scoring !== 'game' && drill.scoring !== 'done' && (
            <p className="runner-verdict">{verdict(drill, saved.set, before)}</p>
          )}
          {levelled && mark !== null && (
            <p className="runner-mark-result">{saved.set.made >= mark ? `Cleared your mark of ${mark}.` : `Your mark is ${mark}. Next one.`}</p>
          )}
          {ask && (
            <div className="level-ask">
              <p>
                Two in a row at or above your mark from {here} ft. Want to move back to {here + LEVEL_STEP} ft next time? Your mark starts
                fresh from there.
              </p>
              <div className="level-ask-btns">
                <button className="btn btn-primary" onClick={() => answer(true)}>
                  Move to {here + LEVEL_STEP} ft
                </button>
                <button className="btn" onClick={() => answer(false)}>
                  Stay at {here} ft
                </button>
              </div>
            </div>
          )}
          {moved !== null && (
            <p className="runner-verdict">
              Your tempo moved to {moved.toFixed(2)} s. Across your tempo sets, balls finished inside 3 ft more often at
              that speed. The next sets test around it.
            </p>
          )}
          {saved.balls && (
            <div className="runner-dots" aria-hidden="true">
              {saved.balls.map((b, i) => (
                <i key={i} className={b ? 'in' : 'out'} />
              ))}
            </div>
          )}
          <div className="runner-actions">
            {once ? (
              <button className="btn btn-primary btn-wide" onClick={onClose}>
                Done
              </button>
            ) : next ? (
              <>
                <button className="btn btn-primary btn-wide" onClick={onNext ?? onClose}>
                  {next}
                </button>
                <button className="btn btn-wide" onClick={again}>
                  Roll it again
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-wide" onClick={again}>
                  {drill.scoring === 'game' ? 'Another game' : 'Roll it again'}
                </button>
                <button className="btn btn-wide" onClick={onClose}>
                  Done
                </button>
              </>
            )}
            <button
              className="linkish small muted"
              onClick={() => {
                dispatch({ t: 'deletePracticeSet', id: saved.set.id });
                setSaved(null);
                setRound((n) => n + 1);
              }}
            >
              Throw this set out
            </button>
          </div>
        </div>
      ) : (
        <Logger key={round} drill={drill} history={before} onSave={save} />
      )}
    </div>
  );
}
