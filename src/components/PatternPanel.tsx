import { BUCKETS, type Stats } from '../lib/stats';
import { Split } from './Bar';
import { TendencyDial } from './TendencyDial';

export function PatternPanel({ stats }: { stats: Stats }) {
  const p = stats.pattern;
  const sideTotal = p.high + p.low;
  const paceTotal = p.short + p.long;
  const lead =
    sideTotal >= 1
      ? p.high >= p.low
        ? `${p.high} of ${sideTotal} break-side misses went high.`
        : `${p.low} of ${sideTotal} break-side misses went low.`
      : 'No break-side misses tagged yet.';

  return (
    <div>
      <TendencyDial high={p.high} low={p.low} short={p.short} long={p.long} />
      <p className="small" style={{ marginTop: 0 }}>
        {lead}
        {paceTotal >= 1 &&
          ` ${p.short >= p.long ? p.short : p.long} of ${paceTotal} pace misses were ${
            p.short >= p.long ? 'short' : 'long'
          }.`}
      </p>

      <div className="field-label">Read bias</div>
      <Split
        parts={[
          { label: 'High', count: p.high, color: '#14392b' },
          { label: 'Low', count: p.low, color: '#4d6558' },
          { label: 'On line', count: p.online, color: '#b5603a' },
        ]}
      />

      <div className="field-label">Pace bias</div>
      <Split
        parts={[
          { label: 'Short', count: p.short, color: '#a52a1f' },
          { label: 'Good', count: p.good, color: '#1f7a4d' },
          { label: 'Long', count: p.long, color: '#b5603a' },
        ]}
      />

      <div className="field-label">Stroke</div>
      <div className="card">
        <div className="stat-row">
          <span className="k">Pushed / pulled</span>
          <span className="v num">
            {p.push} / {p.pull}
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Lip-outs</span>
          <span className={p.lip >= 3 ? 'v num neg' : 'v num'}>{p.lip}</span>
        </div>
        <div className="stat-row">
          <span className="k">Chunked</span>
          <span className="v num">{p.chunk}</span>
        </div>
      </div>

      <div className="field-label">Break side by distance</div>
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Distance</th>
            <th>High</th>
            <th>Low</th>
            <th>On line</th>
          </tr>
        </thead>
        <tbody>
          {BUCKETS.map((b) => {
            const row = p.byBucket[b.key];
            return (
              <tr key={b.key}>
                <td>{b.label}</td>
                <td>{row.high || '--'}</td>
                <td>{row.low || '--'}</td>
                <td>{row.online || '--'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
