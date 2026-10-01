import type { MissAnatomy } from '../lib/stats';

const MIN_JUDGED = 20;

const pct = (n: number, d: number) => Math.round((n / d) * 100);

/**
 * Measured on misses, so it never restates the make rate. Line and pace can both be wrong on
 * one putt, which is why the two headline numbers add past a hundred and the split underneath
 * is the part that adds to it.
 */
export function MissAnatomyPanel({ miss }: { miss: MissAnatomy }) {
  if (miss.judged < MIN_JUDGED) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        Needs {MIN_JUDGED} misses tagged with both a side and a pace, and has {miss.judged}. The
        grid sets both in one tap.
      </p>
    );
  }

  const line = pct(miss.lineWrong, miss.judged);
  const pace = pct(miss.paceWrong, miss.judged);

  return (
    <div>
      <div className="lp-grid">
        <div className="lp-cell">
          <span className="tiny">Line wrong</span>
          <span className="lp-val">{line}%</span>
          <span className="small muted">{miss.lineWrong} of {miss.judged}</span>
        </div>
        <div className="lp-cell">
          <span className="tiny">Pace wrong</span>
          <span className="lp-val">{pace}%</span>
          <span className="small muted">{miss.paceWrong} of {miss.judged}</span>
        </div>
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Both wrong {pct(miss.bothWrong, miss.judged)}% · line only{' '}
        {pct(miss.lineOnly, miss.judged)}% · pace only {pct(miss.paceOnly, miss.judged)}% · lip out{' '}
        {pct(miss.lipOut, miss.judged)}%. A putt can have both wrong, so the two above overlap.{' '}
        {line > pace
          ? 'Your read is costing you more than your stroke.'
          : 'Your speed is costing you more than your read.'}
      </p>
    </div>
  );
}
