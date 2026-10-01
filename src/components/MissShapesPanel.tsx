import type { MissShape } from '../lib/stats';

const MIN_SHAPES = 20;

export function MissShapesPanel({ shapes }: { shapes: MissShape[] }) {
  const total = shapes.reduce((s, x) => s + x.n, 0);
  if (total < MIN_SHAPES) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        Needs {MIN_SHAPES} misses tagged with both a side and a pace, and has {total}.
      </p>
    );
  }
  const top = shapes[0];
  const concentrated = top.share >= 0.4;

  return (
    <div>
      <div className="shape-list">
        {shapes.slice(0, 5).map((s) => (
          <div className="shape-row" key={s.label}>
            <span className="shape-name">{s.label}</span>
            <span className="shape-bar">
              <i style={{ width: `${Math.round((s.n / top.n) * 100)}%` }} />
            </span>
            <span className="shape-pct num">{Math.round(s.share * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        {concentrated
          ? `${Math.round(top.share * 100)}% of your misses are the same shape, so there is one thing to train.`
          : `Your most common miss is only ${Math.round(top.share * 100)}% of them, spread across ${shapes.length} shapes. That is not one mechanical fault, it is variance, and a single drill would be aimed at nothing.`}{' '}
        From {total} tagged misses.
      </p>
    </div>
  );
}
