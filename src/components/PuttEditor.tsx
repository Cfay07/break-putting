import { useEffect, useRef, useState } from 'react';
import { MissGrid } from './MissGrid';
import { SegMulti } from './SegMulti';
import {
  BREAK_DIRS,
  BREAK_LABELS,
  breakDirsOf,
  breakLabel,
  toggleBreak,
  FACTORS,
  FACTOR_LABELS,
  type Putt,
} from '../lib/types';

/**
 * The field used to clamp to a minimum on every keystroke, so clearing it snapped back to 1 and
 * the next digit landed beside it: changing a 2 to a 6 produced 16. Hold what is being typed and
 * only clamp once the field is left.
 */
function Feet({ value, onCommit }: { value: number; onCommit: (ft: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const clean = (text: string) => {
    const n = Math.round(Number(text));
    return text.trim() && Number.isFinite(n) && n >= 1 ? n : null;
  };

  const commit = () => {
    const n = clean(draft);
    if (n !== null) onCommit(n);
    else setDraft(String(value));
  };

  // Closing the sheet can take the field away before it ever blurs, which would drop the
  // number that was just typed. Save it on the way out.
  const pending = useRef({ draft, value, onCommit });
  pending.current = { draft, value, onCommit };
  useEffect(
    () => () => {
      const last = pending.current;
      const n = clean(last.draft);
      if (n !== null && n !== last.value) last.onCommit(n);
    },
    [],
  );

  return (
    <input
      type="number"
      inputMode="numeric"
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

export function PuttEditor({
  putt,
  n,
  onPatch,
  onRemove,
}: {
  putt: Putt;
  n: number;
  onPatch: (patch: Partial<Putt>) => void;
  onRemove: () => void;
}) {
  const dirs = breakDirsOf(putt);

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 10px' }}>Putt {n}</h3>

      <div className="field-label" style={{ marginTop: 0 }}>
        Distance (ft)
      </div>
      <Feet value={putt.d} onCommit={(d) => onPatch({ d })} />

      <div className="field-label">Result</div>
      <div className="seg">
        <button type="button" aria-pressed={!putt.made} onClick={() => onPatch({ made: false })}>
          Missed
        </button>
        <button
          type="button"
          aria-pressed={!!putt.made}
          // A holed putt has no miss side and cannot have lipped out.
          onClick={() => onPatch({ made: true, missSide: undefined, speed: undefined, lip: false })}
        >
          Holed
        </button>
      </div>

      {!putt.made && (
        <>
          <div className="field-label">Where it finished</div>
          <MissGrid
            side={putt.missSide}
            speed={putt.speed}
            onPick={(missSide, speed) => {
              const wasLip = putt.missSide === 'online' && putt.speed === 'good';
              const isLip = missSide === 'online' && speed === 'good';
              onPatch({
                missSide,
                speed,
                ...(isLip ? { lip: true } : wasLip ? { lip: false } : {}),
              });
            }}
          />
        </>
      )}

      {/* A holed putt carries a break read too, so hiding this behind the miss made one
          uncorrectable once it was logged. */}
      <div className="field-label">
        How it broke
        {breakLabel(dirs) ? <span className="muted"> · {breakLabel(dirs)}</span> : null}
      </div>
      <SegMulti
        quiet
        options={BREAK_DIRS}
        labels={BREAK_LABELS}
        values={dirs}
        onToggle={(v) => onPatch({ breakDirs: toggleBreak(dirs, v), breakDir: undefined })}
      />

      <div className="field-label">Factors</div>
      <div className="chips">
        {FACTORS.map((f) => (
          <button
            key={f}
            type="button"
            className={putt[f] ? 'chip chip-sel' : 'chip'}
            aria-pressed={!!putt[f]}
            onClick={() => onPatch({ [f]: !putt[f] })}
          >
            {FACTOR_LABELS[f]}
          </button>
        ))}
      </div>

      <button className="btn btn-ghost btn-wide" style={{ marginTop: 14 }} onClick={onRemove}>
        Remove this putt
      </button>
    </div>
  );
}
