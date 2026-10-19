import { CONVERT_MAX_FT, type ConvertSummary } from '../lib/expected';

export function ConvertedPanel({ c }: { c: ConvertSummary }) {
  if (!c.bands.length) return null;
  const lost = c.made - c.expected;

  return (
    <>
      <div className="card">
        <div className="stat-row">
          <span className="k">Holed, against tour</span>
          <span className={c.vsTour >= 100 ? 'v num pos' : 'v num neg'}>
            {c.vsTour.toFixed(0)}%
            <span className="small muted"> ± {c.se.toFixed(0)}</span>
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Putts holed</span>
          <span className="v num">
            {c.made}
            <span className="small muted"> of {c.putts}</span>
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Tour would have holed</span>
          <span className="v num">{c.expected.toFixed(0)}</span>
        </div>
        <div className="stat-row">
          <span className="k">Putts given away</span>
          <span className={lost < 0 ? 'v num neg' : 'v num pos'}>{lost.toFixed(0)}</span>
        </div>
      </div>

      <div className="field-label">By distance</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Band</th>
              <th>Putts</th>
              <th>You</th>
              <th>Tour</th>
              <th>Putts lost</th>
            </tr>
          </thead>
          <tbody>
            {c.bands.map((b) => (
              <tr key={b.label}>
                <td>{b.label}</td>
                <td className="num">{b.putts}</td>
                <td className="num">{b.yourRate.toFixed(0)}%</td>
                <td className="num">{b.tourRate.toFixed(0)}%</td>
                <td className={b === c.worst ? 'num neg' : 'num'}>{b.puttsVsTour.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {c.worst && c.worst.puttsVsTour < -5 && (
        <p className="small" style={{ margin: '8px 0 0' }}>
          <strong>{c.worst.label}</strong> is the leak. {Math.abs(c.worst.puttsVsTour).toFixed(0)}{' '}
          putts given away there, more than any other band, off {c.worst.putts} attempts.
        </p>
      )}
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Tour make rates come out of the expected-strokes table this app already scores you
        against, so this is the same yardstick as strokes gained asking a different question: not
        what your putting cost, but how often you hole what a tour player holes. It stops at{' '}
        {CONVERT_MAX_FT} feet, where the maths behind the tour rate stops being reliable and lag
        control becomes the right panel.
      </p>
    </>
  );
}
