import type { MissDir } from '../lib/types';

const DIRS: { k: MissDir; label: string }[] = [
  { k: 'left', label: 'Left' },
  { k: 'right', label: 'Right' },
  { k: 'short', label: 'Short' },
  { k: 'long', label: 'Long' },
];

/**
 * Which way the last miss went. One optional tap: ignore it and the next putt carries on, and
 * nothing is ever asked twice. This is what lets practice find a pattern without a round.
 */
export function MissWhich({ value, onPick }: { value?: MissDir; onPick: (d: MissDir) => void }) {
  return (
    <div className="miss-which" role="group" aria-label="Which way did it miss">
      <span className="tiny">Which way?</span>
      {DIRS.map((d) => (
        <button key={d.k} aria-pressed={value === d.k} onClick={() => onPick(d.k)}>
          {d.label}
        </button>
      ))}
    </div>
  );
}
