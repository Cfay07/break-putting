import type { MissShape, SecondLook } from '../lib/stats';

/** Both halves need a real sample before a gap between them means anything. */
const MIN_SIDE = 15;

const pct = (made: number, n: number) => Math.round((made / n) * 100);

export function SecondLookPanel({ rows }: { rows: SecondLook[] }) {
  const usable = rows.filter((r) => r.firstPutts >= MIN_SIDE && r.comebacks >= MIN_SIDE);
  if (!usable.length) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        Needs {MIN_SIDE} first putts and {MIN_SIDE} comebacks in the same distance band before a
        gap between them means anything.
      </p>
    );
  }
  const widest = usable.reduce((a, b) =>
    pct(b.comebackMade, b.comebacks) - pct(b.firstMade, b.firstPutts) >
    pct(a.comebackMade, a.comebacks) - pct(a.firstMade, a.firstPutts)
      ? b
      : a,
  );
  const gap = pct(widest.comebackMade, widest.comebacks) - pct(widest.firstMade, widest.firstPutts);

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Distance</th>
              <th>First putt</th>
              <th>Comeback</th>
              <th>Gap</th>
            </tr>
          </thead>
          <tbody>
            {usable.map((r) => {
              const f = pct(r.firstMade, r.firstPutts);
              const c = pct(r.comebackMade, r.comebacks);
              return (
                <tr key={r.band}>
                  <td>{r.band}</td>
                  <td className="num">
                    {f}% <span className="small muted">of {r.firstPutts}</span>
                  </td>
                  <td className="num">
                    {c}% <span className="small muted">of {r.comebacks}</span>
                  </td>
                  <td className={c - f >= 8 ? 'num pos' : 'num'}>
                    {c - f >= 0 ? '+' : ''}
                    {c - f}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        {gap >= 8
          ? `Same stroke, same length, same green. The only thing that changes on a comeback is that you have watched a ball roll on that line, and from ${widest.band} it is worth ${gap} points. That is a read problem, not a stroke one.`
          : 'A comeback is worth about the same as a first putt from the same distance, so seeing the line once is not what is deciding these.'}
      </p>
    </div>
  );
}

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
