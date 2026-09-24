import { useState } from 'react';
import { Mark } from './ScoreMark';
import { holeVsPar, type Hole } from '../lib/types';

const PARS = [3, 4, 5];

export function fmtVsPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : String(n);
}

/** Eagle through triple covers every hole anyone actually plays; the last cell climbs past it. */
function scoreRange(par: number): number[] {
  const from = Math.max(1, par - 2);
  return Array.from({ length: 7 }, (_, i) => from + i);
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
  const par = hole.par;
  const needsPar = par === undefined || editPar;
  const options = scoreRange(par ?? 4);
  const beyond = hole.strokes !== undefined && !options.includes(hole.strokes);

  return (
    <>
      {needsPar ? (
        <>
          <div className="field-label" style={{ marginTop: 0 }}>
            Par
          </div>
          <div className="seg">
            {PARS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={par === p}
                onClick={() => {
                  onChange({ par: p });
                  setEditPar(false);
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="score-head">
            <span className="field-label" style={{ margin: 0 }}>
              Score
            </span>
            <button type="button" className="linkish tiny" onClick={() => setEditPar(true)}>
              par {par} · change
            </button>
          </div>
          <div className="score-pick">
            {options.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={String(n)}
                aria-pressed={hole.strokes === n}
                onClick={() => onChange({ strokes: hole.strokes === n ? undefined : n })}
              >
                <Mark strokes={n} vsPar={n - (par ?? n)} />
              </button>
            ))}
            <button
              type="button"
              aria-pressed={beyond}
              aria-label="higher score"
              onClick={() =>
                onChange({ strokes: Math.max(hole.strokes ?? 0, options[options.length - 1]) + 1 })
              }
            >
              {beyond ? <Mark strokes={hole.strokes!} vsPar={hole.strokes! - (par ?? 0)} /> : '+'}
            </button>
          </div>
        </>
      )}
      {vsPar !== undefined && (
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          {fmtVsPar(vsPar)} on the hole.{' '}
          {hole.putts.length - vsPar >= 2 ? 'Green in regulation.' : 'Not a green in regulation.'}
        </p>
      )}
    </>
  );
}
