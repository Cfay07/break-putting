import { useMemo, useState } from 'react';
import { fmtDate, today } from '../lib/format';
import { go } from '../lib/router';
import {
  keyOf,
  missesOf,
  recommended,
  REPLAY_BALLS,
  REPLAY_FROM,
  REPLAY_ID,
  REPLAY_TO,
  replayHistory,
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
  made,
  history,
  showWhere,
  onToggle,
  onMade,
}: {
  miss: Miss;
  on: boolean;
  made: number | undefined;
  history: Replayed | undefined;
  showWhere: boolean;
  onToggle: () => void;
  onMade: (n: number) => void;
}) {
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
          Replayed {history.times === 1 ? 'once' : `${history.times} times`} · {history.made} of {history.attempts}
        </p>
      )}
      {on && (
        <div className="rp-log">
          <span>Holed of {REPLAY_BALLS}</span>
          <div className="chips chips-sm">
            {Array.from({ length: REPLAY_BALLS + 1 }, (_, n) => (
              <button
                key={n}
                type="button"
                className={made === n ? 'chip chip-sel' : 'chip'}
                aria-pressed={made === n}
                onClick={() => onMade(n)}
              >
                {n}
              </button>
            ))}
          </div>
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
  const [made, setMade] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<{ made: number; attempts: number } | null>(null);

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

  const toLog = shown.filter((m) => !off.has(m.key) && made[m.key] !== undefined);
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
        made: made[m.key],
        attempts: REPLAY_BALLS,
        stations: [{ d: m.d, mode: 'make', made: made[m.key], attempts: REPLAY_BALLS }],
        replay: m.of,
        updated: at,
      };
      dispatch({ t: 'addPracticeSet', set });
    }
    setSaved({ made: toLog.reduce((n, m) => n + made[m.key], 0), attempts: toLog.length * REPLAY_BALLS });
    setMade({});
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
            Putts you missed from {REPLAY_FROM} to {REPLAY_TO} ft, rebuilt so you can hit them again. {REPLAY_BALLS}{' '}
            balls each.
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
          Saved. {saved.made} of {saved.attempts} holed. It's in your practice log, and each putt keeps its replay
          record.
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
              made={made[m.key]}
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
              onMade={(n) => setMade((x) => ({ ...x, [m.key]: n }))}
            />
          ))}
          <button className="btn btn-primary btn-wide" disabled={!toLog.length} onClick={save} style={{ marginTop: 6 }}>
            {toLog.length
              ? `Save ${toLog.length} ${toLog.length === 1 ? 'replay' : 'replays'}`
              : 'Pick how many you holed'}
          </button>
        </>
      )}
    </div>
  );
}
