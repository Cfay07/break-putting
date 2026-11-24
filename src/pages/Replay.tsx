import { useMemo, useState } from 'react';
import { fmtDate, today } from '../lib/format';
import { go } from '../lib/router';
import {
  keyOf,
  lastReplayText,
  missesOf,
  recommended,
  REDEEM_AFTER,
  redemption,
  REPLAY_FROM,
  REPLAY_ID,
  REPLAY_MISSES,
  REPLAY_TO,
  replayHistory,
  replayResult,
  type Miss,
  type Redemption,
  type Replayed,
  type ReplayMiss,
} from '../lib/replay';
import { fitMakeModel, makeability } from '../lib/makeability';
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

/** One try, like the course: holed, or missed and where it went. */
type Result = { holed: boolean; miss?: ReplayMiss };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function MissCard({
  miss,
  chance,
  on,
  result,
  history,
  showWhere,
  onToggle,
  onResult,
  onUndo,
}: {
  miss: Miss;
  /** Your own make chance on the comebacker a lag left, from your make model. */
  chance: number | null;
  on: boolean;
  result: Result | undefined;
  history: Replayed | undefined;
  showWhere: boolean;
  onToggle: () => void;
  onResult: (r: Result) => void;
  onUndo: () => void;
}) {
  return (
    <div className={on ? 'card replay-card' : 'card replay-card off'}>
      <div className="rp-top">
        <span className="rp-t">
          <b>
            {miss.label}
            {miss.why === 'target' && <span className="rp-tag">Target</span>}
          </b>
          <small>
            {showWhere ? `${fmtDate(miss.date)} · ${miss.course}, hole ${miss.of.hole}` : `Hole ${miss.of.hole}`}
            {miss.forWhat ? ` · ${miss.forWhat}` : ''}
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
      <div className="rp-bits">
        <span>
          <small>On the course</small>
          <b>{miss.bits.missed}</b>
        </span>
        {miss.bits.read && (
          <span>
            <small>Read</small>
            <b>{miss.bits.read}</b>
          </span>
        )}
        {miss.lag && (
          <span>
            <small>Then</small>
            <b>
              {miss.lag.next.made
                ? `Holed the ${miss.lag.leave}-footer`
                : `Missed the ${miss.lag.leave}-footer · ${miss.lag.next.putts} putts`}
              {chance !== null && <em className="rp-xp"> · {Math.round(chance * 100)}% for you</em>}
            </b>
          </span>
        )}
        <span>
          <small>Try</small>
          <b className="rp-fix">{miss.lag ? `${miss.bits.fix} · inside ${miss.lag.within} ft` : miss.bits.fix}</b>
        </span>
      </div>
      {history && <p className="rp-hist">{lastReplayText(history, !!miss.lag)}</p>}
      {on && !result && (
        <div className="rp-log">
          <span className="rp-btns rp-wide">
            <button type="button" className="rp-miss" onClick={() => onResult({ holed: false })}>
              {miss.lag ? 'Outside' : 'Missed'}
            </button>
            <button type="button" className="rp-make" onClick={() => onResult({ holed: true })}>
              {miss.lag ? `Inside ${miss.lag.within} ft` : 'Holed'}
            </button>
          </span>
        </div>
      )}
      {on && result && (
        <div className="rp-log rp-col">
          <span className="rp-res">
            <b className={result.holed ? 'pos' : ''}>{replayResult(miss, result.holed, result.miss)}</b>
            <button type="button" className="linkish tiny" onClick={onUndo}>
              Change
            </button>
          </span>
          {!result.holed && (
            <div className="chips chips-sm">
              {(miss.lag ? REPLAY_MISSES.filter((m) => m === 'short' || m === 'long') : REPLAY_MISSES).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={result.miss === m ? 'chip chip-sel' : 'chip'}
                  aria-pressed={result.miss === m}
                  onClick={() => onResult({ holed: false, miss: m })}
                >
                  {cap(m)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RedemptionCard({ r }: { r: Redemption }) {
  const pct = (m: number, a: number) => (a ? `${Math.round((m / a) * 100)}%` : 'None');
  return (
    <div className="card redeem">
      <p className="rd-k">{r.label}</p>
      <p className="rd-big">
        <b>
          {r.after.made} of {r.after.attempts}
        </b>{' '}
        {r.key.startsWith('lag:') ? 'inside 10% ' : ''}on the course since {fmtDate(r.since)}
      </p>
      <p className="rd-line">
        {pct(r.before.made, r.before.attempts)} before ({r.before.made} of {r.before.attempts}).{' '}
        {r.verdict === 'early'
          ? `${r.after.attempts} of ${REDEEM_AFTER} course putts toward a check.`
          : r.verdict === 'better'
            ? 'Holing more since, past chance. It does not prove the replays did it.'
            : 'Not past chance yet.'}
      </p>
      <p className="rd-line muted">
        Replays: {r.replays.holed} of {r.replays.tries} {r.key.startsWith('lag:') ? 'inside 10%' : 'holed first try'}
        {r.replays.sided ? ` · same miss as the course ${r.replays.same} of ${r.replays.sided}` : ''}
      </p>
    </div>
  );
}

/** Replay your misses: recommended from your target, or picked round by round. One try each. */
export function Replay({ roundId }: { roundId?: string }) {
  const { state, dispatch, surface, putterId } = usePractice();
  const target = useTarget();
  const [view, setView] = useState<View>(roundId ? 'rounds' : readView());
  const [off, setOff] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, Result>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const history = useMemo(() => replayHistory(state.practice), [state.practice]);
  const model = useMemo(() => fitMakeModel(state.rounds.filter((r) => r.finished && !r.practice)), [state.rounds]);
  const redeem = useMemo(
    () => redemption(state.rounds, state.practiceRounds ?? [], state.practice),
    [state.rounds, state.practiceRounds, state.practice],
  );
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

  const toLog = shown.filter((m) => !off.has(m.key) && results[m.key]);
  const save = () => {
    const date = today();
    const at = new Date().toISOString();
    for (const m of toLog) {
      const r = results[m.key];
      const set: PracticeSet = {
        id: newId(),
        date,
        drill: REPLAY_ID,
        surface,
        putterId,
        made: r.holed ? 1 : 0,
        attempts: 1,
        stations: [
          m.lag
            ? { d: m.d, mode: 'zone', zoneFt: m.lag.within, made: r.holed ? 1 : 0, attempts: 1 }
            : { d: m.d, mode: 'make', made: r.holed ? 1 : 0, attempts: 1 },
        ],
        replay: m.of,
        replayMiss: r.miss,
        updated: at,
      };
      dispatch({ t: 'addPracticeSet', set });
    }
    const putts = toLog.filter((m) => !m.lag);
    const lags = toLog.filter((m) => m.lag);
    const holed = putts.filter((m) => results[m.key].holed).length;
    const close = lags.filter((m) => results[m.key].holed).length;
    setSaved(
      [
        putts.length ? `${holed} of ${putts.length} holed` : '',
        lags.length ? `${close} of ${lags.length} ${lags.length === 1 ? 'lag' : 'lags'} inside 10%` : '',
      ]
        .filter(Boolean)
        .join(', '),
    );
    setResults({});
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
            Putts you missed from {REPLAY_FROM} to {REPLAY_TO} ft, and lags that finished outside 10%, rebuilt so you
            can hit them again. One try each, like the course.
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
        <p className="replay-saved">Saved: {saved}. It's in your practice log, and each putt keeps its record.</p>
      )}

      {!open && view === 'rec' && redeem.length > 0 && (
        <>
          <p className="field-label">Redemption</p>
          {redeem.map((r) => (
            <RedemptionCard key={r.key} r={r} />
          ))}
          <p className="small muted" style={{ margin: '6px 2px 0' }}>
            Course putts of each kind you've replayed, before your first replay and since. Course putts only.
          </p>
          <p className="field-label">Replay</p>
        </>
      )}

      {!open && view === 'rec' && target.key && target.title && (
        <p className="small muted" style={{ margin: '10px 0' }}>
          Mostly your target, <b style={{ color: 'var(--ink)' }}>{target.title}</b>, mixed with other putts you keep
          missing.
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
        <p className="small muted">Nothing to replay {open ? 'from this round' : 'yet'}.</p>
      ) : (
        <>
          {shown.map((m) => (
            <MissCard
              key={m.key}
              miss={m}
              chance={m.lag ? makeability(model, m.lag.leave, m.lag.next.dirs) : null}
              on={!off.has(m.key)}
              result={results[m.key]}
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
              onResult={(r) => setResults((x) => ({ ...x, [m.key]: r }))}
              onUndo={() =>
                setResults((x) => {
                  const next = { ...x };
                  delete next[m.key];
                  return next;
                })
              }
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
