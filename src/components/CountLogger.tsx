import { useMemo, useState } from 'react';
import type { FittedStation } from '../lib/drills';
import { MODE_WORDS, tallyStations } from '../lib/practiceView';
import type { BallMode } from '../lib/types';
import type { LoggerProps } from './DrillLogger';

interface Row {
  d: number;
  mode: BallMode;
  label?: string;
  balls: number;
  movedFrom?: number;
}

/** The sheet's rows, with repeats of the same distance and label folded into one stepper. */
function rowsOf(stations: FittedStation[]): Row[] {
  const rows: Row[] = [];
  for (const s of stations) {
    const mode = s.mode ?? 'make';
    const same = rows.find((r) => r.d === s.d && r.mode === mode && r.label === s.label);
    if (same) same.balls += s.balls;
    else rows.push({ d: s.d, mode, label: s.label, balls: s.balls, movedFrom: s.movedFrom });
  }
  return rows;
}

export function stationName(s: { d: number; label?: string; movedFrom?: number }): string {
  const where = s.d > 0 ? `${s.d} ft` : '';
  const moved = s.movedFrom ? ` (was ${s.movedFrom})` : '';
  return [where + moved, s.label].filter(Boolean).join(' · ');
}

/**
 * Made out of N. Ball by ball for a single station, steppers for a sheet row of several, and
 * either one a tap away from the other.
 */
export function CountLogger({ drill, onSave }: LoggerProps) {
  const rows = useMemo(() => rowsOf(drill.stations), [drill]);
  const queue = useMemo(() => drill.stations.flatMap((s) => Array.from({ length: s.balls }, () => s)), [drill]);
  const [steppers, setSteppers] = useState(rows.length > 1);
  const [balls, setBalls] = useState<boolean[]>([]);
  const [counts, setCounts] = useState<number[]>(() => rows.map(() => 0));

  if (steppers) {
    const made = counts.reduce((a, b) => a + b, 0);
    const of = rows.reduce((a, r) => a + r.balls, 0);
    const save = () =>
      onSave({
        made,
        attempts: of,
        stations: rows
          .map((r, i) => ({ d: r.d, mode: r.mode, made: counts[i], attempts: r.balls }))
          .filter((s) => s.d > 0),
      });
    return (
      <div className="runner-body">
        <p className="small muted">{drill.how}</p>
        <div className="step-rows">
          {rows.map((r, i) => (
            <div key={i} className="step-row">
              <span className="step-k">
                <strong>{stationName(r)}</strong>
                {r.mode !== 'make' && <span className="small muted">{MODE_WORDS[r.mode].noun}</span>}
              </span>
              <button
                className="step-btn"
                aria-label={`One fewer at ${stationName(r)}`}
                disabled={!counts[i]}
                onClick={() => setCounts(counts.map((c, j) => (j === i ? c - 1 : c)))}
              >
                −
              </button>
              <span className="step-v num">
                {counts[i]}
                <span className="muted">/{r.balls}</span>
              </span>
              <button
                className="step-btn on"
                aria-label={`One more at ${stationName(r)}`}
                disabled={counts[i] >= r.balls}
                onClick={() => setCounts(counts.map((c, j) => (j === i ? c + 1 : c)))}
              >
                +
              </button>
            </div>
          ))}
        </div>
        <div className="step-total">
          <span className="muted">Total</span>
          <strong className="num">
            {made} of {of}
          </strong>
        </div>
        <div className="runner-actions">
          <button className="btn btn-primary btn-wide" onClick={save}>
            Save set
          </button>
          <button className="linkish small muted" onClick={() => setSteppers(false)}>
            Count it ball by ball instead
          </button>
        </div>
      </div>
    );
  }

  const station = queue[Math.min(balls.length, queue.length - 1)];
  const mode = station.mode ?? 'make';
  const atStation = queue.map((s, i) => ({ s, i })).filter((x) => x.s === station);
  const first = atStation[0].i;
  const here = balls.slice(first, first + atStation.length);
  const made = balls.filter(Boolean).length;

  const tap = (hit: boolean) => {
    const next = [...balls, hit];
    setBalls(next);
    if (next.length === queue.length) {
      onSave(
        {
          made: next.filter(Boolean).length,
          attempts: next.length,
          stations: tallyStations(queue.map((s, i) => ({ d: s.d, mode: s.mode ?? 'make', made: next[i] }))),
        },
        next,
      );
    }
  };

  return (
    <div className="runner-body">
      <p className="small muted">{drill.how}</p>
      {drill.stations.length > 1 && <p className="runner-station">{stationName(station)}</p>}
      <div className="runner-dots" aria-label={`${here.filter(Boolean).length} of ${here.length} here`}>
        {atStation.map((_, i) => (
          <i key={i} className={i < here.length ? (here[i] ? 'in' : 'out') : undefined} />
        ))}
      </div>
      <div className="runner-score num">
        {made}
        <span className="runner-of">{MODE_WORDS[mode].noun}</span>
      </div>
      <p className="tiny runner-ball">
        Ball {Math.min(balls.length + 1, queue.length)} of {queue.length}
      </p>
      <div className="runner-btns">
        <button className="runner-no" onClick={() => tap(false)}>
          {MODE_WORDS[mode].no}
        </button>
        <button className="runner-yes" onClick={() => tap(true)}>
          {MODE_WORDS[mode].yes}
        </button>
      </div>
      <div className="runner-foot">
        <button className="linkish small muted" disabled={!balls.length} onClick={() => setBalls(balls.slice(0, -1))}>
          Undo
        </button>
        <button className="linkish small muted" onClick={() => setSteppers(true)}>
          Type the score
        </button>
      </div>
    </div>
  );
}
