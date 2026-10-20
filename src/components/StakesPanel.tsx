import { MIN_ATTEMPTS, type Stakes } from '../lib/stakes';
import { pctText } from '../lib/format';

export function StakesPanel({ stakes }: { stakes: Stakes }) {
  if (!stakes.rows.length) {
    return (
      <div className="card">
        <p className="small muted" style={{ margin: 0 }}>
          Needs rounds with a par and a score on each hole, from {stakes.band.from} to{' '}
          {stakes.band.to} feet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        {stakes.rows.map((r) => (
          <div className="stat-row" key={r.vsPar}>
            <span className="k">
              {r.label}
              <span className="muted">
                {' '}
                · {r.attempts} from {r.avgFt.toFixed(1)} ft
              </span>
            </span>
            <span className="v num">
              {r.rate === null ? `${r.makes}/${r.attempts}` : pctText(r.rate)}
            </span>
          </div>
        ))}
      </div>

      {stakes.gap && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          {stakes.gap.points > 0 ? (
            <>
              You hole {stakes.gap.points} more putts in a hundred when the putt is to save par
              than when it is for birdie, from the same distance.{' '}
              {Math.abs(stakes.gap.z) >= 2
                ? 'Unlikely to be chance.'
                : 'Suggestive, not proven yet: it needs more putts before it is more than a hint.'}
            </>
          ) : (
            <>
              Birdie tries and par saves convert at about the same rate from the same distance, so
              what the putt is worth is not changing how you hit it.
            </>
          )}
        </p>
      )}

      <p className="small muted" style={{ margin: '6px 0 0' }}>
        First putts only, {stakes.band.from} to {stakes.band.to} feet. Both matter: putts to save
        bogey are usually comebacks, and comebacks are short, which invents a trend out of
        distance alone. A second putt is also rolled on a green you have already read. A row needs{' '}
        {MIN_ATTEMPTS} putts before it shows a percentage.
      </p>
    </div>
  );
}
