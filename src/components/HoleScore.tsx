import { useState } from 'react';
import { holeVsPar, type Hole } from '../lib/types';

const PARS = [3, 4, 5];

export function fmtVsPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : String(n);
}

export function HoleScore({
  hole,
  onChange,
}: {
  hole: Hole;
  onChange: (patch: { par?: number; strokes?: number }) => void;
}) {
  const [editPar, setEditPar] = useState(false);
  const vsPar = holeVsPar(hole);
  const showChips = hole.par === undefined || editPar;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: '0 0 92px' }}>
          <div className="field-label" style={{ marginTop: 0 }}>
            Score
          </div>
          <input
            type="number"
            inputMode="numeric"
            className="score-input num"
            value={hole.strokes ?? ''}
            onChange={(e) =>
              onChange({ strokes: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </div>
        <div style={{ flex: 1 }}>
          <div className="field-label" style={{ marginTop: 0 }}>
            Par
          </div>
          {showChips ? (
            <div className="seg">
              {PARS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={hole.par === p}
                  onClick={() => {
                    onChange({ par: hole.par === p ? undefined : p });
                    setEditPar(false);
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-wide"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => setEditPar(true)}
            >
              Par {hole.par} · change
            </button>
          )}
        </div>
      </div>
      {vsPar !== undefined && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          {fmtVsPar(vsPar)} on the hole.{' '}
          {hole.putts.length - vsPar >= 2 ? 'Green in regulation.' : 'Not a green in regulation.'}
        </p>
      )}
    </>
  );
}
