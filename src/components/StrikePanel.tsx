import { MIN_STRIKE, type StrikeRow } from '../lib/stats';

/**
 * Strike against distance control. The leave column is a share of the putt rather than feet,
 * so a forty footer and a six footer can sit in the same column without the long ones deciding
 * the answer on their own.
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
              <th>Made</th>
              <th>Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="num">{r.putts}</td>
                <td className="num">{r.makePct === null ? '--' : `${Math.round(r.makePct)}%`}</td>
                <td className="num">
                  {r.leavePct === null ? '--' : `${r.leavePct.toFixed(1)}% of the putt`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Left is how far past or short the ball finished as a share of the putt, counting misses
        only, so a toe strike that leaks distance shows up whatever length you hit it from. A row
        needs {MIN_STRIKE} putts before it prints a number, and a count on its own with two dashes
        beside it means you have tagged it but not enough of it yet.
      </p>
    </>
  );
}
