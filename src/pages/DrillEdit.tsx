import { useState } from 'react';
import { ConfirmButton } from '../components/ConfirmButton';
import { resolveDrill, SCORING_LABELS } from '../lib/drills';
import { MODE_WORDS, ON_MISS_TEXT } from '../lib/practiceView';
import { go, replaceRoute } from '../lib/router';
import { newId } from '../lib/storage';
import { useApp } from '../lib/store';
import type { BallMode, DrillDef, OnMiss, Scoring, Station, Surface } from '../lib/types';
import { SURFACE_LABELS } from '../lib/types';

const SCORINGS: { k: Scoring; sub: string }[] = [
  { k: 'count', sub: '8 of 10' },
  { k: 'streak', sub: 'Miss starts over' },
  { k: 'ladder', sub: 'Stations in order' },
  { k: 'game', sub: 'Against a teammate' },
  { k: 'done', sub: 'Range, chipping' },
];

const MODES: BallMode[] = ['make', 'twoputt', 'zone'];
const MISSES: OnMiss[] = ['end', 'restart', 'stay', 'back'];
const MISS_SHORT: Record<OnMiss, string> = {
  end: 'Ends it',
  restart: 'Start over',
  stay: 'Go again',
  back: 'Back one',
  checkpoint: 'Checkpoint',
};

function Step({
  value,
  set,
  min = 0,
  max = 99,
  label,
  unit,
}: {
  value: number;
  set: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  unit?: string;
}) {
  return (
    <span className="mini-step">
      <button aria-label={`Less ${label}`} disabled={value <= min} onClick={() => set(value - 1)}>
        −
      </button>
      <span className="num" aria-label={label}>
        {value}
        {unit && <span className="muted">{unit}</span>}
      </span>
      <button aria-label={`More ${label}`} disabled={value >= max} onClick={() => set(value + 1)}>
        +
      </button>
    </span>
  );
}

function blank(): DrillDef {
  return {
    id: newId(),
    name: '',
    scoring: 'count',
    stations: [{ d: 5, balls: 10 }],
    how: '',
    surfaces: ['indoor', 'green'],
    putting: true,
    source: 'mine',
  };
}

export function DrillEdit({ id }: { id: string }) {
  const { state, dispatch } = useApp();
  const original = id === 'new' ? undefined : resolveDrill(state, id);
  const [d, setD] = useState<DrillDef>(() => (original ? structuredClone(original) : blank()));
  const patch = (p: Partial<DrillDef>) => setD((x) => ({ ...x, ...p }));
  const station = (i: number, p: Partial<Station>) =>
    patch({ stations: d.stations.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  if (id !== 'new' && !original) {
    return (
      <div className="empty">
        That drill is gone. <a href="#/practice">Back to Practice</a>
      </div>
    );
  }

  const mine = original?.source === 'mine';
  const save = () => {
    const clean: DrillDef = {
      ...d,
      name: d.name.trim() || 'My drill',
      stations: d.scoring === 'game' || d.scoring === 'done' ? [] : d.stations,
    };
    // Someone else's drill is never changed in place: you get a copy that stands in for it.
    const out = !original || mine ? clean : { ...clean, id: newId(), source: 'mine' as const, from: original.id };
    dispatch({ t: 'saveDrill', drill: out });
    go(`/practice/drill/${out.from ?? out.id}`);
  };

  const needsStations = d.scoring === 'count' || d.scoring === 'ladder' || d.scoring === 'streak';
  const rows = d.scoring === 'streak' ? d.stations.slice(0, 1) : d.stations;

  return (
    <div>
      <div className="page-top">
        <a href={original ? `#/practice/drill/${original.from ?? original.id}` : '#/practice'} className="back-link">
          Cancel
        </a>
        <button className="btn btn-primary save-top" onClick={save}>
          Save
        </button>
      </div>
      <h1 className="page-title">{original ? 'Edit drill' : 'New drill'}</h1>
      {original && !mine && (
        <p className="small muted" style={{ margin: '2px 0 0' }}>
          Saves as your copy. The original stays as written.
        </p>
      )}

      <label className="field">
        <span className="field-label">Name</span>
        <input value={d.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Dorm 5 footers" />
      </label>

      <span className="field-label">How it's scored</span>
      <div className="score-grid">
        {SCORINGS.map((s) => (
          <button
            key={s.k}
            className={d.scoring === s.k ? 'score-opt on' : 'score-opt'}
            aria-pressed={d.scoring === s.k}
            onClick={() =>
              patch({
                scoring: s.k,
                stations: d.stations.length ? d.stations : [{ d: 5, balls: 10 }],
                onMiss: s.k === 'ladder' ? (d.onMiss ?? 'end') : d.onMiss,
                putting: s.k === 'done' ? d.putting : true,
              })
            }
          >
            <strong>{SCORING_LABELS[s.k]}</strong>
            <span>{s.sub}</span>
          </button>
        ))}
      </div>

      {needsStations && (
        <>
          <span className="field-label">{d.scoring === 'streak' ? 'Distance' : 'Stations'}</span>
          <div className="edit-rows">
            {rows.map((s, i) => (
              <div key={i} className="edit-row">
                <Step label="feet" unit=" ft" value={s.d} min={1} max={90} set={(v) => station(i, { d: v, far: false })} />
                {d.scoring !== 'streak' && (
                  <Step label="balls" unit=" balls" value={s.balls} min={1} max={50} set={(v) => station(i, { balls: v, need: s.need && Math.min(s.need, v) })} />
                )}
                {d.scoring === 'ladder' && (
                  <Step label="needed" unit=" to clear" value={s.need ?? s.balls} min={1} max={s.balls} set={(v) => station(i, { need: v })} />
                )}
                {d.scoring === 'count' && (
                  <button
                    className="chip chips-sm-chip"
                    onClick={() => station(i, { mode: MODES[(MODES.indexOf(s.mode ?? 'make') + 1) % MODES.length] })}
                  >
                    {MODE_WORDS[s.mode ?? 'make'].yes}
                  </button>
                )}
                {d.scoring !== 'streak' && d.stations.length > 1 && (
                  <button
                    className="linkish small muted"
                    aria-label="Remove station"
                    onClick={() => patch({ stations: d.stations.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {d.scoring !== 'streak' && (
            <button
              className="linkish add-row"
              onClick={() => {
                const last = d.stations[d.stations.length - 1];
                patch({ stations: [...d.stations, { ...last, d: Math.min(90, last.d + 1), movedFrom: undefined } as Station] });
              }}
            >
              Add a station
            </button>
          )}
        </>
      )}

      {d.scoring === 'streak' && (
        <div className="edit-rows">
          <div className="edit-row">
            <span className="small">In a row to finish</span>
            <Step label="target" value={d.target ?? 0} max={100} set={(v) => patch({ target: v || undefined })} />
            <span className="small muted">{d.target ? '' : 'none, go until you stop'}</span>
          </div>
        </div>
      )}

      {d.scoring === 'ladder' && (
        <>
          <span className="field-label">When a station fails</span>
          <div className="chips chips-sm">
            {MISSES.map((m) => (
              <button key={m} className={d.onMiss === m ? 'chip chip-sel' : 'chip'} onClick={() => patch({ onMiss: m })}>
                {MISS_SHORT[m]}
              </button>
            ))}
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {ON_MISS_TEXT[d.onMiss ?? 'end']}
          </p>
        </>
      )}

      <div className="edit-rows" style={{ marginTop: 14 }}>
        <div className="edit-row">
          <span className="small">Minutes in a session</span>
          <Step label="minutes" value={d.minutes ?? 0} max={120} set={(v) => patch({ minutes: v || undefined })} />
        </div>
        {(d.scoring === 'streak' || d.scoring === 'ladder') && (
          <div className="edit-row">
            <span className="small">Clock, to finish inside</span>
            <Step label="clock minutes" unit=" min" value={d.limit ?? 0} max={60} set={(v) => patch({ limit: v || undefined })} />
          </div>
        )}
      </div>

      <span className="field-label">Works on</span>
      <div className="seg">
        {(['indoor', 'green'] as Surface[]).map((s) => {
          const on = d.surfaces.includes(s);
          return (
            <button
              key={s}
              aria-pressed={on}
              onClick={() => {
                const next = on ? d.surfaces.filter((x) => x !== s) : [...d.surfaces, s];
                if (next.length) patch({ surfaces: next });
              }}
            >
              {SURFACE_LABELS[s]}
            </button>
          );
        })}
      </div>

      <label className="field">
        <span className="field-label">How to set it up</span>
        <textarea value={d.how} onChange={(e) => patch({ how: e.target.value })} placeholder="Tees, balls, what counts" />
      </label>

      <div className="btn-row" style={{ marginTop: 18 }}>
        {original?.from && (
          <ConfirmButton
            label="Back to the original"
            confirmLabel="Drop my changes?"
            className="btn"
            onConfirm={() => {
              dispatch({ t: 'deleteDrill', id: original.id });
              replaceRoute(`/practice/drill/${original.from}`);
            }}
          />
        )}
        {mine && !original?.from && (
          <ConfirmButton
            label="Delete drill"
            confirmLabel="Delete it?"
            onConfirm={() => {
              dispatch({ t: 'deleteDrill', id: original!.id });
              replaceRoute('/practice');
            }}
          />
        )}
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}
