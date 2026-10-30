import { scoreOf, type DrillHistory } from '../lib/practice';

/** One column per set, newest on the right, the best in the accent. */
export function SetColumns({ h, max = 16, tall }: { h: DrillHistory; max?: number; tall?: boolean }) {
  const sets = h.sets.slice(-max);
  // A share is already out of one; a run or a ladder is drawn against its own best.
  const shares = sets.every((s) => s.run === undefined && s.reached === undefined);
  const top = shares ? 1 : Math.max(...sets.map(scoreOf), 0.0001);
  return (
    <span className={tall ? 'cols cols-tall' : 'cols'} aria-hidden="true">
      {sets.map((s) => (
        <i
          key={s.id}
          className={s === h.best ? 'best' : s.surface === 'indoor' ? 'indoor' : undefined}
          style={{ height: `${Math.max(8, (scoreOf(s) / top) * 100)}%` }}
        />
      ))}
    </span>
  );
}
