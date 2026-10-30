import { useEffect, useMemo, useState } from 'react';
import type { FittedStation } from '../lib/drills';
import { MODE_WORDS, tallyStations } from '../lib/practiceView';
import type { BallMode, Hand, MissDir } from '../lib/types';
import { clearTestRun, loadTestRun, saveTestRun, TEST_ID } from '../lib/weeklyTest';
import { MissWhich } from './MissWhich';
import type { LoggerProps } from './DrillLogger';

interface Row {
  d: number;
  mode: BallMode;
  zoneFt?: number;
  hand?: Hand;
  label?: string;
  balls: number;
  movedFrom?: number;
}

/** The sheet's rows, with repeats of the same distance and label folded into one stepper. */
function rowsOf(stations: FittedStation[]): Row[] {
  const rows: Row[] = [];
  for (const s of stations) {
    const mode = s.mode ?? 'make';
    const same = rows.find((r) => r.d === s.d && r.mode === mode && r.zoneFt === s.zoneFt && r.label === s.label && r.hand === s.hand);
    if (same) same.balls += s.balls;
    else rows.push({ d: s.d, mode, zoneFt: s.zoneFt, hand: s.hand, label: s.label, balls: s.balls, movedFrom: s.movedFrom });
  }
  return rows;
}

export function stationName(s: { d: number; label?: string; hand?: Hand; movedFrom?: number }): string {
  const where = s.d > 0 ? `${s.d} ft` : '';
  const moved = s.movedFrom ? ` (was ${s.movedFrom})` : '';
  const hand = s.hand && !s.label ? `${s.hand === 'left' ? 'left' : 'right'} hand` : '';
  return [where + moved, s.label ?? hand].filter(Boolean).join(' · ');
}

/**
 * Made out of N. Ball by ball for a single station, steppers for a sheet row of several, and
 * either one a tap away from the other.
 */
export function CountLogger({ drill, onSave }: LoggerProps) {
  const rows = useMemo(() => rowsOf(drill.stations), [drill]);
  const queue = useMemo(() => drill.stations.flatMap((s) => Array.from({ length: s.balls }, () => s)), [drill]);
  // Lag and speed balls are counted one at a time: which balls finished inside is the point.
  // Steppers only lead for several distances of plain makes, five or more each.
  const [steppers, setSteppers] = useState(
    () => rows.length > 1 && drill.stations.every((st) => st.balls >= 5 && (st.mode ?? 'make') === 'make'),
  );
  const isTest = drill.id === TEST_ID;
  const [resumed] = useState(() => (isTest ? loadTestRun(queue) : null));
  const [balls, setBalls] = useState<boolean[]>(resumed?.balls ?? []);
  const [dirs, setDirs] = useState<(MissDir | undefined)[]>(resumed?.dirs ?? []);
  const [counts, setCounts] = useState<number[]>(() => rows.map(() => 0));

  useEffect(() => {
    if (!isTest) return;
    if (balls.length && balls.length < queue.length) saveTestRun(queue, balls, dirs);
    else clearTestRun();
  }, [isTest, queue, balls, dirs]);

  if (steppers) {
    const made = counts.reduce((a, b) => a + b, 0);
    const of = rows.reduce((a, r) => a + r.balls, 0);
    const save = () => {
      if (isTest) clearTestRun();
      onSave({
        made,
        attempts: of,
        stations: rows
          .map((r, i) => ({
            d: r.d,
            mode: r.mode,
            ...(r.zoneFt ? { zoneFt: r.zoneFt } : {}),
            ...(r.hand ? { hand: r.hand } : {}),
            made: counts[i],
            attempts: r.balls,
          }))
          .filter((s) => s.d > 0),
      });
    };
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
  // A drill that mixes holing out with lag, like the weekly test, counts both in one number.
  const mixed = new Set(queue.map((s) => s.mode ?? 'make')).size > 1;

  const tap = (hit: boolean) => {
    const next = [...balls, hit];
    setBalls(next);
    setDirs([...dirs.slice(0, balls.length), undefined]);
    if (next.length === queue.length) {
      // Saving closes this counter before its effect could run, so it has to happen here.
      if (isTest) clearTestRun();
      onSave(
        {
          made: next.filter(Boolean).length,
          attempts: next.length,
          stations: tallyStations(
            queue.map((s, i) => ({ d: s.d, mode: s.mode ?? 'make', zoneFt: s.zoneFt, hand: s.hand, made: next[i], dir: dirs[i] })),
          ),
        },
        next,
      );
    }
  };
  const lastMissed = balls.length > 0 && !balls[balls.length - 1];

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
        <span className="runner-of">{mixed ? 'counted' : MODE_WORDS[mode].noun}</span>
      </div>
      <p className="tiny runner-ball">
        Ball {Math.min(balls.length + 1, queue.length)} of {queue.length}
      </p>
      {lastMissed && (
        <MissWhich
          value={dirs[balls.length - 1]}
          onPick={(d) => setDirs(dirs.map((x, i) => (i === balls.length - 1 ? d : x)))}
        />
      )}
      <div className="runner-btns">
        <button className="runner-no" onClick={() => tap(false)}>
          {MODE_WORDS[mode].no}
        </button>
        <button className="runner-yes" onClick={() => tap(true)}>
          {MODE_WORDS[mode].yes}
        </button>
      </div>
      <div className="runner-foot">
        <button
          className="linkish small muted"
          disabled={!balls.length}
          onClick={() => {
            setBalls(balls.slice(0, -1));
            setDirs(dirs.slice(0, -1));
          }}
        >
          Undo
        </button>
        <button className="linkish small muted" onClick={() => setSteppers(true)}>
          Type the score
        </button>
      </div>
    </div>
  );
}
