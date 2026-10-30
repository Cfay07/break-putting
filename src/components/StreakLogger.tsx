import { useEffect, useState } from 'react';
import { clock } from '../lib/practiceView';
import type { LoggerProps } from './DrillLogger';
import { useNow } from './useNow';

/** The run going now, the best one, and how many times a miss reset it. */
export function replayStreak(hits: boolean[]): { current: number; best: number; restarts: number } {
  let current = 0;
  let best = 0;
  let restarts = 0;
  for (const h of hits) {
    if (h) {
      best = Math.max(best, ++current);
    } else {
      if (current > 0) restarts++;
      current = 0;
    }
  }
  return { current, best, restarts };
}

const R = 96;
const RING = 2 * Math.PI * R;

/**
 * Makes in a row. With a target it stops the moment you get there and keeps the time; without
 * one it runs until you end it. A clock, when the drill has one, starts on the first putt.
 */
export function StreakLogger({ drill, history, onSave }: LoggerProps) {
  const [hits, setHits] = useState<boolean[]>([]);
  const [started, setStarted] = useState<number | null>(null);
  const now = useNow(started !== null);
  const { current, best, restarts } = replayStreak(hits);
  const d = drill.stations[0]?.d ?? 0;
  const elapsed = started !== null ? (now - started) / 1000 : 0;
  const left = drill.limit ? drill.limit * 60 - elapsed : null;

  const save = (all: boolean[], finished?: boolean) => {
    const r = replayStreak(all);
    onSave({
      made: all.filter(Boolean).length,
      attempts: all.length,
      run: r.best,
      finished,
      seconds: started !== null ? Math.round((Date.now() - started) / 1000) : undefined,
      stations: d > 0 ? [{ d, mode: drill.stations[0].mode ?? 'make', made: all.filter(Boolean).length, attempts: all.length }] : [],
    });
  };

  const timedOut = left !== null && left <= 0;
  useEffect(() => {
    if (timedOut) save(hits, drill.target ? false : undefined);
    // Fires once, the moment the clock runs out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  const tap = (hit: boolean) => {
    if (started === null) setStarted(Date.now());
    const next = [...hits, hit];
    setHits(next);
    if (drill.target && replayStreak(next).current >= drill.target) save(next, true);
  };

  const goal = drill.target ?? Math.max(10, (history?.best.run ?? 0) + 1);
  const ring = Math.min(1, current / goal);
  const fastest = history?.sets
    .filter((s) => s.finished && s.seconds !== undefined)
    .reduce<number | null>((a, s) => (a === null || s.seconds! < a ? s.seconds! : a), null);

  return (
    <div className="runner-body">
      <p className="small muted">{drill.how}</p>
      <div className="ring-wrap">
        <svg viewBox="0 0 220 220" className="ring" role="img" aria-label={`${current} in a row`}>
          <circle cx="110" cy="110" r={R} className="ring-track" />
          <circle
            cx="110"
            cy="110"
            r={R}
            className="ring-fill"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - ring)}
            transform="rotate(-90 110 110)"
          />
          <text x="110" y="112" textAnchor="middle" className="ring-n">
            {current}
          </text>
          <text x="110" y="142" textAnchor="middle" className="ring-sub">
            {drill.target ? `in a row, need ${drill.target}` : 'in a row'}
          </text>
        </svg>
        {left !== null && (
          <span className="ring-clock num">
            {clock(left)} <span className="muted">left of {clock(drill.limit! * 60)}</span>
          </span>
        )}
        {left === null && started !== null && <span className="ring-clock num">{clock(elapsed)}</span>}
      </div>
      <div className="mini-stats">
        <div>
          <strong className="num">{best}</strong>
          <span>Best this set</span>
        </div>
        <div>
          <strong className="num">{restarts}</strong>
          <span>Restarts</span>
        </div>
        {drill.target && fastest != null && (
          <div>
            <strong className="num">{clock(fastest)}</strong>
            <span>Your fastest</span>
          </div>
        )}
        {!drill.target && history?.best.run !== undefined && (
          <div>
            <strong className="num">{history.best.run}</strong>
            <span>Best ever</span>
          </div>
        )}
      </div>
      <div className="runner-btns">
        <button className="runner-no" onClick={() => tap(false)}>
          Missed
        </button>
        <button className="runner-yes" onClick={() => tap(true)}>
          Made
        </button>
      </div>
      <div className="runner-foot">
        <button className="linkish small muted" disabled={!hits.length} onClick={() => setHits(hits.slice(0, -1))}>
          Undo
        </button>
        <button className="btn" disabled={!hits.length} onClick={() => save(hits, drill.target ? false : undefined)}>
          End set
        </button>
      </div>
    </div>
  );
}
