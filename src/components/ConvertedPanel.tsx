import { CONVERT_MAX_FT, type ConvertSummary } from '../lib/expected';

export function ConvertedPanel({ c, rounds }: { c: ConvertSummary; rounds: number }) {
  if (!c.bands.length) return null;
  const lost = c.made - c.expected;
  const perRound = rounds > 0 ? lost / rounds : null;

  return (
    <>
      <div className="card">
        <div className="shoot-for num neg">{lost.toFixed(0)}</div>
        <p className="small" style={{ margin: '4px 0 0' }}>
          Putts you did not hole that a tour player would have, from the same distances, inside{' '}
          {CONVERT_MAX_FT} feet. {perRound !== null && `About ${Math.abs(perRound).toFixed(1)} a round.`}
        </p>
        <div className="stat-row" style={{ marginTop: 8 }}>
          <span className="k">Holed</span>
          <span className="v num">
            {c.made}
            <span className="small muted"> of {c.putts}</span>
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Tour would have holed</span>
          <span className="v num">{c.expected.toFixed(0)}</span>
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
        against, so it is the same yardstick strokes gained uses, asked a different way: not what
        the putting cost in strokes, but how many putts went unholed. It stops at{' '}
        {CONVERT_MAX_FT} feet, where the maths behind the tour rate stops being reliable and lag
        control becomes the right panel.
      </p>
    </>
  );
}
