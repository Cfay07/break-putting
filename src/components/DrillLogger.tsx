import { useState } from 'react';
import { distanceText, familyOf, scoringLabel, type Fitted } from '../lib/drills';
import { today } from '../lib/format';
import { historyOf, type DrillHistory } from '../lib/practice';
import { setScore, verdict } from '../lib/practiceView';
import { newId } from '../lib/storage';
import { useApp } from '../lib/store';
import type { PracticeSet, Surface } from '../lib/types';
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
  drill,
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
  // Taken when the set starts, so the comparison is with what came before it.
  const [before, setBefore] = useState(() => historyOf(state.practice, family(drill.id), family));
  const [saved, setSaved] = useState<{ set: PracticeSet; balls?: boolean[] } | null>(null);
  const [round, setRound] = useState(0);
  const Logger = LOGGERS[drill.scoring];

  const save = (r: SetResult, balls?: boolean[]) => {
    const set: PracticeSet = {
      id: newId(),
      date: today(),
      drill: drill.id,
      surface,
      putterId: state.putters.find((p) => p.active)?.id,
      ...(session ? { session } : {}),
      ...r,
    };
    dispatch({ t: 'addPracticeSet', set });
    setSaved({ set, balls });
    onSaved?.(set);
  };

  const again = () => {
    if (saved && drill.scoring !== 'game') {
      setBefore((h) => {
        const sets = [...(h?.sets ?? []), saved.set];
        return historyOf(sets, family(drill.id), family);
      });
    }
    setSaved(null);
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
        <button className="linkish tiny" onClick={onClose}>
          {saved ? 'Done' : 'Close'}
        </button>
      </div>

      {saved ? (
        <div className="runner-body">
          <div className="runner-result">{setScore(drill, saved.set)}</div>
          {drill.scoring !== 'game' && drill.scoring !== 'done' && (
            <p className="runner-verdict">{verdict(drill, saved.set, before)}</p>
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
