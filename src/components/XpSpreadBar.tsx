import type { XpSpread } from '../lib/xp';

const LO = 1.0;
const HI = 2.3;
const at = (v: number) => ((v - LO) / (HI - LO)) * 100;

/**
 * Where your putts sit between a tap-in and a three-putt risk.
 *
 * The two anchors carry the whole explanation: 1.00 is holed, and 2.00 is the point where your
 * chance of holing it equals your chance of three-putting it, which falls out of the arithmetic
 * rather than being a line anyone drew.
 */
export function XpSpreadBar({ spread }: { spread: XpSpread }) {
  const tallest = Math.max(1, ...spread.bins.map((b) => b.n));

  return (
    <div className="xps">
      <div className="xps-bars">
        {spread.bins.map((b) => (
          <span
            key={b.from}
            className={b.from >= 2 ? 'xps-bar past' : 'xps-bar'}
            style={{ height: `${Math.max(b.n ? 6 : 0, (b.n / tallest) * 100)}%` }}
            title={`${b.from.toFixed(2)}–${b.to.toFixed(2)} · ${b.n} putts`}
          />
        ))}
        <span className="xps-mark" style={{ left: `${at(2)}%` }} />
        {spread.median !== null && (
          <span className="xps-median" style={{ left: `${at(spread.median)}%` }} />
        )}
      </div>
      <div className="xps-axis">
        <span>1.00 holed</span>
        <span>2.00 two-putt</span>
      </div>
      <div className="xps-legend">
        <span>
          <b>{spread.median?.toFixed(2) ?? '--'}</b> typical
        </span>
        <span>
          <b>{spread.hardest?.toFixed(2) ?? '--'}</b> hardest faced
        </span>
        <span>
          <b>{spread.pastTwo}</b> past the two-putt mark
        </span>
      </div>
    </div>
  );
}
