import { useState } from 'react';
import { rainOn, rainWords, RAIN_FLOOR } from '../lib/weather';

const BUMPY = [
  { n: 1, label: 'Smooth' },
  { n: 2, label: 'Average' },
  { n: 3, label: 'Bumpy' },
];

/**
 * What the greens were like, beyond how fast they rolled. Recorded and never scored against:
 * see weather.ts for why a guessed penalty would be worse than none.
 */
export function Conditions({
  aerated,
  bumpy,
  rainMm,
  date,
  lat,
  lon,
  onChange,
}: {
  aerated: boolean | undefined;
  bumpy: number | undefined;
  rainMm: number | undefined;
  date: string;
  lat?: number;
  lon?: number;
  onChange: (patch: { aerated?: boolean; bumpy?: number; rainMm?: number }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const look = async () => {
    if (lat === undefined || lon === undefined) {
      setNote('No location for this course, so the weather cannot be looked up.');
      return;
    }
    setBusy(true);
    setNote('');
    const mm = await rainOn(date, lat, lon);
    setBusy(false);
    if (mm === null) return setNote('The weather archive did not answer.');
    onChange({ rainMm: mm });
  };

  return (
    <>
      <div className="field-label">Greens, beyond speed</div>
      <div className="chips">
        <button
          type="button"
          className={aerated ? 'chip chip-sel' : 'chip'}
          aria-pressed={!!aerated}
          onClick={() => onChange({ aerated: !aerated })}
        >
          Aerated
        </button>
        {BUMPY.map((b) => (
          <button
            key={b.n}
            type="button"
            className={bumpy === b.n ? 'chip chip-sel' : 'chip'}
            aria-pressed={bumpy === b.n}
            onClick={() => onChange({ bumpy: bumpy === b.n ? undefined : b.n })}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="field-label">Rain that day</div>
      {rainMm === undefined ? (
        <button className="btn btn-ghost btn-wide" disabled={busy} onClick={look}>
          {busy ? 'Checking…' : 'Look it up'}
        </button>
      ) : (
        <div className="stat-row">
          <span className="k">{rainWords(rainMm)}</span>
          <button className="linkish tiny" onClick={() => onChange({ rainMm: undefined })}>
            Clear
          </button>
        </div>
      )}
      {note && (
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          {note}
        </p>
      )}
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        {rainMm !== undefined && rainMm >= RAIN_FLOOR
          ? 'Kept with the round. It does not change strokes gained: nobody knows what a wet green costs yet, so it gets measured before it gets charged.'
          : 'Free archive lookup, no account. Stored with the round and never scored against it.'}
      </p>
    </>
  );
}
