import { useState } from 'react';
import { go } from '../lib/router';
import type { BeatSpread } from '../lib/xp';

const LO = -2;
const HI = 1;
const at = (v: number) => ((v - LO) / (HI - LO)) * 100;

/** What a bucket means, said rather than left to be decoded off an axis. */
function saying(from: number, to: number, n: number, total: number): string {
  const share = total ? Math.round((n / total) * 100) : 0;
  const what =
    from >= 0
      ? 'holes you beat the number on'
      : to <= -0.9
        ? 'holes that cost you a full shot or more'
        : 'holes you came up short on';
  if (!n) return `No ${what} between ${from.toFixed(2)} and ${to.toFixed(2)}.`;
  return `${n} ${what}, ${share}% of all of them, between ${from.toFixed(2)} and ${to.toFixed(2)}.`;
}

/**
 * How often you beat what the hole was worth.
 *
 * The chart this replaced plotted expected putts, which sorted holes in almost exactly the order
 * their length does. It drew a picture of what the course handed you. This one is about what you
 * did with it, and zero is the only line it needs.
 */
export function BeatBar({ spread, compact = false }: { spread: BeatSpread; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const tallest = Math.max(1, ...spread.bins.map((b) => b.n));
  const picked = open === null ? null : spread.bins[open];

  return (
    <div>
      <div className="beat-bars">
        {spread.bins.map((b, i) => (
          <button
            key={b.from}
            type="button"
            className={`beat-col${open === i ? ' on' : ''}`}
            aria-pressed={open === i}
            aria-label={`${b.from.toFixed(2)} to ${b.to.toFixed(2)}, ${b.n} holes`}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span
              className={b.from >= 0 ? 'beat-bar up' : 'beat-bar down'}
              style={{ height: `${Math.max(b.n ? 6 : 2, (b.n / tallest) * 100)}%` }}
            />
          </button>
        ))}
        <span className="beat-zero" style={{ left: `${at(0)}%` }} />
      </div>
      <div className="beat-axis">
        <span>−2 lost</span>
        <span>0</span>
        <span>+1 gained</span>
      </div>

      <p className={picked ? 'beat-read' : 'beat-read muted'}>
        {picked ? saying(picked.from, picked.to, picked.n, spread.n) : 'Tap a column.'}
      </p>

      <div className="beat-legend">
        <span>
          <b>{spread.n ? Math.round((spread.beat / spread.n) * 100) : 0}%</b> of holes beaten
        </span>
        {!compact && spread.best && (
          <button
            type="button"
            className="beat-jump"
            onClick={() => go(`/round/${spread.best!.roundId}/hole/${spread.best!.hole}`)}
          >
            <b>+{spread.best.sg.toFixed(2)}</b> best · {spread.best.ft} ft →
          </button>
        )}
        {!compact && spread.worst && (
          <button
            type="button"
            className="beat-jump"
            onClick={() => go(`/round/${spread.worst!.roundId}/hole/${spread.worst!.hole}`)}
          >
            <b>{spread.worst.sg.toFixed(2)}</b> worst · {spread.worst.ft} ft →
          </button>
        )}
      </div>
    </div>
  );
}
