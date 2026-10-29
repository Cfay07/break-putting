import { useState } from 'react';
import { go } from '../lib/router';
import type { XpSpread } from '../lib/xp';

const LO = 1.0;
const HI = 2.3;
const at = (v: number) => ((v - LO) / (HI - LO)) * 100;

/** What a bucket of expected putts actually means, in words rather than in a number. */
function saying(from: number, to: number, n: number, total: number): string {
  const share = total ? Math.round((n / total) * 100) : 0;
  const where =
    to <= 1.3
      ? 'close enough that holing it is the expectation'
      : to <= 1.6
        ? 'a real chance, and a two-putt if it misses'
        : from >= 2.0
          ? 'past the mark where holing it and three-putting it are equally likely'
          : 'a two-putt most days, with the make still live';
  if (!n) return `No putts between ${from.toFixed(2)} and ${to.toFixed(2)}. That band is ${where}.`;
  return `${n} putt${n === 1 ? '' : 's'} worth ${from.toFixed(2)} to ${to.toFixed(2)}, ${share}% of the ones you tagged. ${where[0].toUpperCase()}${where.slice(1)}.`;
}

/**
 * Where your putts sit between a tap-in and a three-putt risk.
 *
 * The two anchors carry the whole explanation: 1.00 is holed, and 2.00 is the point where your
 * chance of holing it equals your chance of three-putting it, which falls out of the arithmetic
 * rather than being a line anyone drew.
 */
export function XpSpreadBar({ spread }: { spread: XpSpread }) {
  const [open, setOpen] = useState<number | null>(null);
  const tallest = Math.max(1, ...spread.bins.map((b) => b.n));
  const picked = open === null ? null : spread.bins[open];

  return (
    <div className="xps">
      <div className="xps-bars">
        {spread.bins.map((b, i) => (
          <button
            key={b.from}
            type="button"
            className={`xps-col${open === i ? ' on' : ''}`}
            aria-pressed={open === i}
            aria-label={`${b.from.toFixed(2)} to ${b.to.toFixed(2)}, ${b.n} putts`}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span
              className={b.from >= 2 ? 'xps-bar past' : 'xps-bar'}
              style={{ height: `${Math.max(b.n ? 6 : 2, (b.n / tallest) * 100)}%` }}
            />
          </button>
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

      {picked ? (
        <p className="xps-read">{saying(picked.from, picked.to, picked.n, spread.n)}</p>
      ) : (
        <p className="xps-read muted">Tap a column.</p>
      )}

      {spread.beyondTable > 0 && (
        <p className="xps-note">
          {spread.beyondTable} putt{spread.beyondTable === 1 ? '' : 's'} past 60 ft are left out of
          "hardest". The baseline table ends there and returns the same number for everything
          beyond it, so a 61 footer and a 77 footer score alike. That is the table running out,
          not a fact about the putt.
        </p>
      )}
      <div className="xps-legend">
        <span>
          <b>{spread.median?.toFixed(2) ?? '--'}</b> typical
        </span>
        {spread.hardest && (
          <button
            type="button"
            className="xps-jump"
            onClick={() => go(`/round/${spread.hardest!.roundId}/hole/${spread.hardest!.hole}`)}
          >
            <b>{spread.hardest.xp.toFixed(2)}</b> hardest faced
            <span className="xps-where">
              {spread.hardest.d} ft · {spread.hardest.label} · hole {spread.hardest.hole} →
            </span>
          </button>
        )}
        <span>
          <b>{spread.pastTwo}</b> past the two-putt mark
        </span>
      </div>
    </div>
  );
}
