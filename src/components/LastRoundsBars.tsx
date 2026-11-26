import { fmtDate } from '../lib/format';

type Bar = { id: string; date: string; shot: number; withTour: number };

/** Your last eight scores next to the same rounds with tour putting, oldest on the left. */
export function LastRoundsBars({ rounds }: { rounds: Bar[] }) {
  const shown = rounds.slice(0, 8).reverse();
  if (shown.length < 2) return null;
  const all = shown.flatMap((r) => [r.shot, r.withTour]);
  const lo = Math.min(...all) - 4;
  const hi = Math.max(...all);
  const h = (v: number) => `${Math.round(((v - lo) / (hi - lo)) * 100)}%`;
  return (
    <div className="card last-bars-card">
      <div className="last-bars" role="img" aria-label="Your last scores against the same rounds with tour putting">
        {shown.map((r) => (
          <div
            className="last-bar"
            key={r.id}
            title={`${fmtDate(r.date)}: ${r.shot.toFixed(0)} shot, ${r.withTour.toFixed(1)} with tour putting`}
          >
            <div className="last-pair">
              <i className="shot" style={{ height: h(r.shot) }} />
              <i className="tour" style={{ height: h(r.withTour) }} />
            </div>
            <small>{fmtDate(r.date)}</small>
          </div>
        ))}
      </div>
      <div className="last-key">
        <span>
          <i className="shot" /> You shot
        </span>
        <span>
          <i className="tour" /> With tour putting
        </span>
      </div>
    </div>
  );
}
