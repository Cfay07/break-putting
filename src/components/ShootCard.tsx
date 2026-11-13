import { fmtDate } from '../lib/format';

export interface ShootRound {
  id: string;
  date: string;
  /** Scaled up to eighteen when the round was shorter. */
  shot: number;
  withTour: number;
  short: boolean;
}

const SHOWN = 8;

function scaleFor(values: number[]) {
  const lo = Math.floor(Math.min(...values) / 2) * 2;
  const hi = Math.max(lo + 4, Math.ceil(Math.max(...values) / 2) * 2);
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return { lo, hi, at };
}

interface Props {
  shoot: number;
  withTour: number;
  /** Newest first. */
  rounds: ShootRound[];
  anyShort: boolean;
}

/**
 * The two averages, then your recent rounds drawn as the same gap: where you finished and where a
 * tour pro's putter would have left you. The bar between them is what the putter cost or saved.
 */
export function ShootCard({ shoot, withTour, rounds, anyShort }: Props) {
  const shown = rounds.slice(0, SHOWN);
  const { lo, hi, at } = scaleFor(shown.flatMap((r) => [r.shot, r.withTour]));
  const gap = shoot - withTour;

  return (
    <div className="hcp-card light">
      <div className="stand-grid">
        <div>
          <span className="pay-eyebrow">You shoot</span>
          <strong className="num">{shoot.toFixed(1)}</strong>
        </div>
        <div>
          <span className="pay-eyebrow">With tour putting</span>
          <strong className="num">{withTour.toFixed(1)}</strong>
        </div>
      </div>

      <p className="hcp-how">
        Your scoring average over {rounds.length} scored {rounds.length === 1 ? 'round' : 'rounds'}, and the same
        rounds with a tour pro's putting dropped in.{' '}
        {gap >= 0
          ? `A tour pro's putter would save you ${gap.toFixed(1)} a round. Strokes gained is measured against tour, so read it as the gap to a pro's putter, not to a decent amateur one.`
          : `You putt better than tour, so their putter would cost you ${(-gap).toFixed(1)} a round. The strokes are somewhere else.`}
      </p>

      {shown.length > 0 && (
        <>
          <div className="hcp-chart">
            {shown.map((r) => {
              const left = Math.min(r.shot, r.withTour);
              const right = Math.max(r.shot, r.withTour);
              return (
                <a key={r.id} className="hcp-lane shoot-lane" href={`#/round/${r.id}`}>
                  <span className="hcp-date">
                    {fmtDate(r.date)}
                    {r.short && <small> 9</small>}
                  </span>
                  <span className="hcp-track">
                    <i
                      className={r.shot > r.withTour ? 'shoot-gap cost' : 'shoot-gap saved'}
                      style={{ left: at(left), width: `calc(${at(right)} - ${at(left)})` }}
                    />
                    <i className="shoot-dot tour" style={{ left: at(r.withTour) }} />
                    <i className="shoot-dot me" style={{ left: at(r.shot) }} />
                  </span>
                  <b className="num">
                    {Math.round(r.shot)} <span className="muted">→</span> {r.withTour.toFixed(1)}
                  </b>
                </a>
              );
            })}
            <div className="hcp-lane shoot-lane hcp-axis">
              <span />
              <span className="hcp-track">
                {[lo, Math.round((lo + hi) / 2), hi].map((v) => (
                  <span key={v} className="hcp-mark" style={{ left: at(v) }}>
                    {v}
                  </span>
                ))}
              </span>
              <span />
            </div>
          </div>
          <span className="hcp-key">
            <i className="game" /> You shot <i /> With tour putting
          </span>
          <p className="pay-note">
            Your last {shown.length}, newest first.
            {rounds.length > shown.length ? ` The averages above use all ${rounds.length}.` : ''}
            {anyShort ? ' A round shorter than eighteen is scaled up so it compares to one.' : ''}
          </p>
        </>
      )}
    </div>
  );
}
