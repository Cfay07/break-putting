import { useMemo, useState } from 'react';
import { fmtDate, today } from '../lib/format';
import { go } from '../lib/router';
import {
  keyOf,
  missesOf,
  recommended,
  MAX_TRIES,
  REPLAY_FROM,
  REPLAY_ID,
  REPLAY_TO,
  replayHistory,
  triesText,
  type Miss,
  type Replayed,
} from '../lib/replay';
import { newId } from '../lib/storage';
import { usePractice } from '../lib/usePractice';
import { useTarget } from '../lib/useTarget';
import type { PracticeSet, Round } from '../lib/types';

type View = 'rec' | 'rounds';
const VIEW_KEY = 'break.replayView';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'rounds' ? 'rounds' : 'rec';
  } catch {
    return 'rec';
  }
}

function MissCard({
  miss,
  on,
  tries,
  history,
  showWhere,
  onToggle,
  onTry,
  onUndo,
}: {
  miss: Miss;
  on: boolean;
  /** This replay so far: false for a miss, true for the one that dropped. */
  tries: boolean[];
  history: Replayed | undefined;
  showWhere: boolean;
  onToggle: () => void;
  onTry: (holed: boolean) => void;
  onUndo: () => void;
}) {
  const holed = tries.at(-1) === true;
  const done = holed || tries.length >= MAX_TRIES;
  return (
    <div className={on ? 'card replay-card' : 'card replay-card off'}>
      <div className="rp-top">
        <span className="rp-t">
          <b>{miss.label}</b>
          <small>
            {showWhere ? `${fmtDate(miss.date)} · ${miss.course}, hole ${miss.of.hole}` : `Hole ${miss.of.hole}`}
            {miss.practice ? ' · practice round' : ''}
          </small>
        </span>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={on}
          aria-label={`Replay ${miss.label}`}
          onClick={onToggle}
        />
      </div>
      <p className="rp-what">{miss.what}</p>
      <p className="rp-set">{miss.setup}</p>
      {history && (
        <p className="rp-hist">
          Last time: {triesText(history.lastTries, history.lastHoled).toLowerCase()}
          {history.times > 1 ? ` · replayed ${history.times} times` : ''}
        </p>
      )}
      {on && (
        <div className="rp-log">
          <div className="rp-balls" aria-label={tries.length ? triesText(tries.length, holed) : 'No tries yet'}>
            {tries.map((t, i) => (
              <i key={i} className={t ? 'ball in' : 'ball out'} />
            ))}
            {!done && <i className="ball next" />}
          </div>
          {done ? (
            <span className="rp-done">
              <b className={holed ? 'pos' : ''}>{triesText(tries.length, holed)}</b>
              <button type="button" className="linkish tiny" onClick={onUndo}>
                Undo
              </button>
            </span>
          ) : (
            <span className="rp-btns">
              <button type="button" className="rp-miss" onClick={() => onTry(false)}>
                Missed
              </button>
              <button type="button" className="rp-make" onClick={() => onTry(true)}>
                Holed
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Replay your misses: recommended from your target, or picked round by round. */
export function Replay({ roundId }: { roundId?: string }) {
  const { state, dispatch, surface, putterId } = usePractice();
  const target = useTarget();
  const [view, setView] = useState<View>(roundId ? 'rounds' : readView());
  const [off, setOff] = useState<Set<string>>(new Set());
  const [tries, setTries] = useState<Record<string, boolean[]>>({});
  const [saved, setSaved] = useState<{ putts: number; holed: number; avg: number | null } | null>(null);

  const history = useMemo(() => replayHistory(state.practice), [state.practice]);
  const rounds = useMemo(
    () =>
      [
        ...state.rounds.filter((r) => r.finished && !r.practice).map((r) => ({ r, practice: false })),
        ...(state.practiceRounds ?? []).map((r) => ({ r, practice: true })),
      ].sort((a, b) => b.r.date.localeCompare(a.r.date)),
    [state.rounds, state.practiceRounds],
  );
  const rec = useMemo(
    () => recommended(state.rounds, state.practiceRounds ?? [], target.key, history),
    [state.rounds, state.practiceRounds, target.key, history],
  );
  const open: { r: Round; practice: boolean } | undefined = roundId
    ? rounds.find((x) => x.r.id === roundId)
    : undefined;
  const shown: Miss[] = open ? missesOf(open.r, open.practice) : view === 'rec' ? rec : [];

  const pick = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Private mode: the choice just does not stick.
    }
    if (roundId) go('/practice/replay');
  };

  const toLog = shown.filter((m) => !off.has(m.key) && (tries[m.key]?.length ?? 0) > 0);
  const save = () => {
    const date = today();
    const at = new Date().toISOString();
    for (const m of toLog) {
      const set: PracticeSet = {
        id: newId(),
        date,
        drill: REPLAY_ID,
        surface,
        putterId,
        made: tries[m.key].at(-1) ? 1 : 0,
        attempts: tries[m.key].length,
        stations: [{ d: m.d, mode: 'make', made: tries[m.key].at(-1) ? 1 : 0, attempts: tries[m.key].length }],
        replay: m.of,
        updated: at,
      };
      dispatch({ t: 'addPracticeSet', set });
    }
    const holed = toLog.filter((m) => tries[m.key].at(-1));
    setSaved({
      putts: toLog.length,
      holed: holed.length,
      avg: holed.length ? holed.reduce((n, m) => n + tries[m.key].length, 0) / holed.length : null,
    });
    setTries({});
  };

  return (
    <div>
      <button className="linkish tiny" onClick={() => go(open ? '/practice/replay' : '/practice')}>
        ‹ {open ? 'Replay' : 'Practice'}
      </button>
      <h1 className="page-title">
        {open ? `${fmtDate(open.r.date)} · ${open.r.course ?? 'Round'}` : 'Replay your misses'}
      </h1>
      {!open && (
        <>
          <p className="small muted" style={{ margin: '0 0 12px' }}>
            Putts you missed from {REPLAY_FROM} to {REPLAY_TO} ft, rebuilt so you can hit them again. Hit each one until
            it drops.
          </p>
          <div className="seg" role="group" aria-label="Which putts">
            <button aria-pressed={view === 'rec'} onClick={() => pick('rec')}>
              Recommended
            </button>
            <button aria-pressed={view === 'rounds'} onClick={() => pick('rounds')}>
              By round
            </button>
          </div>
        </>
      )}

      {saved && (
        <p className="replay-saved">
          Saved {saved.putts} {saved.putts === 1 ? 'replay' : 'replays'}.{' '}
          {saved.avg !== null
            ? `${saved.holed} dropped, on try ${saved.avg.toFixed(1)} on average.`
            : 'None dropped yet.'}{' '}
          It's in your practice log, and each putt keeps its record.
        </p>
      )}

      {!open && view === 'rec' && target.key && target.title && (
        <p className="small muted" style={{ margin: '10px 0' }}>
          Picked from your target first: <b style={{ color: 'var(--ink)' }}>{target.title}</b>.
        </p>
      )}

      {!open && view === 'rounds' ? (
        <div className="card replay-rounds">
          {rounds.map(({ r, practice }) => {
            const n = missesOf(r, practice).length;
            if (!n) return null;
            return (
              <button key={r.id} className="replay-round" onClick={() => go(`/practice/replay/${r.id}`)}>
                <span>
                  <b>
                    {fmtDate(r.date)} · {r.course ?? (practice ? 'Practice round' : 'Round')}
                  </b>
                  <small>{practice ? 'Practice round' : 'Round'}</small>
                </span>
                <span className="muted">{n === 1 ? '1 miss' : `${n} misses`}</span>
                <span className="chev">›</span>
              </button>
            );
          })}
        </div>
      ) : shown.length === 0 ? (
        <p className="small muted">No misses from 3 to 12 ft {open ? 'in this round' : 'to replay yet'}.</p>
      ) : (
        <>
          {shown.map((m) => (
            <MissCard
              key={m.key}
              miss={m}
              on={!off.has(m.key)}
              tries={tries[m.key] ?? []}
              history={history.get(keyOf(m.of))}
              showWhere={!open}
              onToggle={() =>
                setOff((s) => {
                  const next = new Set(s);
                  if (next.has(m.key)) next.delete(m.key);
                  else next.add(m.key);
                  return next;
                })
              }
              onTry={(holed) => setTries((x) => ({ ...x, [m.key]: [...(x[m.key] ?? []), holed] }))}
              onUndo={() => setTries((x) => ({ ...x, [m.key]: (x[m.key] ?? []).slice(0, -1) }))}
            />
          ))}
          {toLog.length > 0 && (
            <button className="btn btn-primary btn-wide" onClick={save} style={{ marginTop: 6 }}>
              Save {toLog.length} {toLog.length === 1 ? 'replay' : 'replays'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
