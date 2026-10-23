import type { ReadSummary } from '../lib/readError';

const AMOUNT: Record<number, string> = { 0: 'Straight', 1: 'Slight', 2: 'Some', 3: 'Lots', 4: 'Severe' };

/** Enough tagged reads before a share is worth printing as a tendency rather than a coincidence. */
const MIN_JUDGED = 8;

export function ReadPanel({ read }: { read: ReadSummary }) {
  if (!read.judged) return null;
  const pct = (n: number) => `${Math.round((n / read.judged) * 100)}%`;

  return (
    <>
      <div className="card">
        <div className="stat-row">
          <span className="k">Reads tagged</span>
          <span className="v num">{read.judged}</span>
        </div>
        <div className="stat-row">
          <span className="k">Read it right</span>
          <span className="v num pos">
            {pct(read.hadIt)}
            <span className="small muted"> · {read.hadIt}</span>
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Played too little break</span>
          <span className={read.under > read.over ? 'v num neg' : 'v num'}>
            {pct(read.under)}
            <span className="small muted"> · {read.under}</span>
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Played too much</span>
          <span className={read.over > read.under ? 'v num neg' : 'v num'}>
            {pct(read.over)}
            <span className="small muted"> · {read.over}</span>
          </span>
        </div>
        {/* Only when it has happened. A zero row for the worst read available is noise. */}
        {read.wrong > 0 && (
          <div className="stat-row">
            <span className="k">Read the turn backwards</span>
            <span className="v num neg">
              {pct(read.wrong)}
              <span className="small muted"> · {read.wrong}</span>
            </span>
          </div>
        )}
      </div>

      {read.bands.length > 1 && (
        <>
          <div className="field-label">By how much it actually broke</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Break</th>
                  <th>Putts</th>
                  <th>Read right</th>
                  <th>Too little</th>
                  {read.wrong > 0 && <th>Backwards</th>}
                  <th>Miss by</th>
                </tr>
              </thead>
              <tbody>
                {read.bands.map((b) => (
                  <tr key={b.amount}>
                    <td>{AMOUNT[b.amount] ?? b.amount}</td>
                    <td className="num">{b.putts}</td>
                    <td className="num">{Math.round((b.hadIt / b.putts) * 100)}%</td>
                    <td className={b.under > b.hadIt ? 'num neg' : 'num'}>
                      {Math.round((b.under / b.putts) * 100)}%
                    </td>
                    {read.wrong > 0 && (
                      <td className={b.wrong ? 'num neg' : 'num'}>
                        {b.wrong ? `${Math.round((b.wrong / b.putts) * 100)}%` : '--'}
                      </td>
                    )}
                    <td className="num">{b.avgLeave === null ? '--' : `${b.avgLeave.toFixed(1)} ft`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            If the too-little column climbs as the break gets bigger, you are under-reading the
            severe ones. Miss by is how far the ball finished from the hole when it did not drop.
          </p>
        </>
      )}

      {read.sides.length === 2 && (
        <>
          <div className="field-label">Which way it breaks</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Break</th>
                  <th>Putts</th>
                  <th>Read right</th>
                  <th>Too little</th>
                  <th>Too much</th>
                </tr>
              </thead>
              <tbody>
                {read.sides.map((d) => (
                  <tr key={d.key}>
                    <td>{d.label}</td>
                    <td className="num">{d.putts}</td>
                    <td className="num">{Math.round((d.right / d.putts) * 100)}%</td>
                    <td className={d.under > d.right ? 'num neg' : 'num'}>
                      {Math.round((d.under / d.putts) * 100)}%
                    </td>
                    <td className="num">{Math.round((d.over / d.putts) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            Most right-handers miss one of these two far more than the other. Double breakers are
            left out, because the error does not belong to either side.
          </p>
        </>
      )}

      {read.leaveWhenRight !== null && read.leaveWhenWrong !== null && (
        <p className="small" style={{ margin: '10px 0 0' }}>
          A miss with the read right finishes {read.leaveWhenRight.toFixed(1)} ft away. With the
          read wrong, {read.leaveWhenWrong.toFixed(1)} ft.
        </p>
      )}

      {read.blamed >= MIN_JUDGED && (
        <>
          <div className="field-label">What the misses were</div>
          <div className="card">
            <div className="stat-row">
              <span className="k">The read</span>
              <span className="v num">{read.blameRead}</span>
            </div>
            <div className="stat-row">
              <span className="k">The stroke, pushed or pulled</span>
              <span className="v num">{read.blameStroke}</span>
            </div>
            <div className="stat-row">
              <span className="k">The speed, read and line were fine</span>
              <span className="v num">{read.blameSpeed}</span>
            </div>
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            Push and pull are the start line, so a miss with the read right and a clean start was
            the pace. This is the only split the three tags allow and it needs all three.
          </p>
        </>
      )}
    </>
  );
}
