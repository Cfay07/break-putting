import { useMemo, useState } from 'react';
import { DIAL_MAX, dialAt, dialEnds, type DialPutt } from '../lib/dial';
import { fmtDate } from '../lib/format';
import { go } from '../lib/router';
import type { Round } from '../lib/types';

const KEY = 'break.dial';

function readFt(): number {
  try {
    const n = Number(localStorage.getItem(KEY));
    return n >= 1 && n <= DIAL_MAX ? n : 5;
  } catch {
    return 5;
  }
}

function End({ label, p }: { label: string; p: DialPutt | null }) {
  if (!p) return null;
  return (
    <button className="dial-end" onClick={() => go(`/round/${p.roundId}/hole/${p.hole}`)}>
      <small>{label}</small>
      <b>{p.d} ft</b>
      <span>
        {fmtDate(p.date)}, hole {p.hole}
      </span>
    </button>
  );
}

/** Dial in a length and see what you make from there, in the filtered rounds. */
export function Dial({ rounds, half }: { rounds: Round[]; half: number | null }) {
  const [ft, setFt] = useState(readFt);
  const read = useMemo(() => dialAt(rounds, ft), [rounds, ft]);
  const ends = useMemo(() => dialEnds(rounds), [rounds]);
  const pick = (n: number) => {
    setFt(n);
    try {
      localStorage.setItem(KEY, String(n));
    } catch {
      // Private mode: the dial just starts at 5 ft next time.
    }
  };
  const span = read.lo === read.hi ? `${read.d} ft` : `${read.lo} to ${read.hi} ft`;
  return (
    <div className="card dial">
      <div className="dial-big">
        <b className="num">{read.tried ? `${Math.round((read.made / read.tried) * 100)}%` : '--'}</b>
        <span>from {ft} ft</span>
      </div>
      <p className="dial-at">
        {read.tried ? `${read.made} of ${read.tried} putts from ${span}` : `No putts near ${ft} ft yet`}
      </p>
      <input
        type="range"
        min={1}
        max={DIAL_MAX}
        step={1}
        value={ft}
        onChange={(e) => pick(Number(e.target.value))}
        aria-label="Distance in feet"
        className="dial-range"
      />
      <div className="dial-ft">
        <span>1 ft</span>
        <span>10</span>
        <span>20</span>
        <span>{DIAL_MAX} ft</span>
      </div>
      <div className="dial-ends">
        {half !== null && (
          <span className="dial-end">
            <small>50% from</small>
            <b>{half.toFixed(1)} ft</b>
            <span>where half go in</span>
          </span>
        )}
        <End label="Shortest miss" p={ends.shortestMiss} />
        <End label="Longest make" p={ends.longestMake} />
      </div>
    </div>
  );
}
