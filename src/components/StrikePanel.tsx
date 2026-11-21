import { MIN_STRIKE, type StrikeRow } from '../lib/stats';

/**
 * Strike against what the ball did. Holed sits beside what your own make rate at those lengths
 * says you would have holed, because different strikes come from different lengths and a raw make
 * rate turned a handful of short toe putts into a toe that looked better than the middle. Left is
 * a share of the putt, so a forty footer and a six footer can share the column.
 */
export function StrikePanel({ rows }: { rows: StrikeRow[] }) {
  const total = rows.reduce((n, r) => n + r.putts, 0);
  if (!total) return null;

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Strike</th>
              <th>Putts</th>
              <th>Holed</th>
              <th>Usual</th>
              <th>Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="num">{r.putts}</td>
                <td className="num">{r.expected === null ? '--' : r.makes}</td>
                <td className="num">{r.expected === null ? '--' : Math.round(r.expected)}</td>
                <td className="num">{r.leavePct === null ? '--' : `${r.leavePct.toFixed(1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Usual is what you hole from those same lengths on every putt you have logged, so Holed above Usual means that
        strike did better than normal. Left is how far a miss finished as a share of the putt. A row needs {MIN_STRIKE}{' '}
        putts before it shows numbers.
      </p>
    </>
  );
}
