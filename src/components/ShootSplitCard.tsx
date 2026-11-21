import type { Piece, ShootSplit, Within } from '../lib/statsHome';

const SHADES = ['#6e1a12', '#a52a1f', '#c0533a', '#d98a6e', '#e7b3a1', '#f1d3c8', '#f6e4dd'];

/**
 * What you would be shooting: your average, the same rounds with tour putting, and the gap between
 * them in pieces by where the putt started, biggest first. The card you show a friend, and the
 * first thing to practice under it.
 */
export function ShootSplitCard({
  split,
  within,
  practice,
}: {
  split: ShootSplit;
  within: Within | null;
  /** The session for the biggest piece, when there is one. */
  practice: { label: string; start: () => void } | null;
}) {
  const losses = split.pieces.filter((p) => p.sg < -0.005).sort((a, b) => a.sg - b.sg);
  const gains = split.pieces.filter((p) => p.sg > 0.005);
  const gap = losses.reduce((a, p) => a - p.sg, 0);
  const top: Piece | undefined = losses[0];

  return (
    <div className="card shoot-split">
      <p className="ss-title">What you would be shooting</p>
      <div className="ss-big">
        <div>
          <span>You shoot</span>
          <strong className="num">{split.shoot.toFixed(1)}</strong>
        </div>
        <span className="ss-arrow">→</span>
        <div>
          <span>With tour putting</span>
          <strong className="num pos">{split.withTour.toFixed(1)}</strong>
        </div>
      </div>

      {losses.length > 0 ? (
        <>
          <p className="ss-lead">The {gap.toFixed(1)} strokes between them, by where the putt started</p>
          <div className="ss-bar">
            {losses.map((p, i) => (
              <i key={p.key} style={{ width: `${(-p.sg / gap) * 100}%`, background: SHADES[i] }} />
            ))}
          </div>
          <div className="ss-ends">
            <span>{split.shoot.toFixed(1)}</span>
            <span>{(split.shoot - gap).toFixed(1)}</span>
          </div>
          {losses.map((p, i) => (
            <div className="ss-leg" key={p.key}>
              <i style={{ background: SHADES[i] }} />
              <span>{p.label}</span>
              <b className="num neg">−{(-p.sg).toFixed(1)}</b>
              <small className="num">{Math.round((-p.sg / gap) * 100)}%</small>
            </div>
          ))}
        </>
      ) : (
        <p className="ss-lead">You putt better than tour from every range.</p>
      )}

      {gains.length > 0 && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          {gains.map((p) => p.label).join(', ')}: you already beat tour, by{' '}
          {gains.reduce((a, p) => a + p.sg, 0).toFixed(2)} a round.
        </p>
      )}

      {top && within && (
        <p className="ss-within">
          Within {top.label}, <b>{within.label}</b> cost you most: {(-within.perPutt).toFixed(2)} a putt over{' '}
          {within.putts} putts.
        </p>
      )}
      {practice && (
        <button className="btn btn-primary btn-wide" style={{ marginTop: 10 }} onClick={practice.start}>
          {practice.label}
        </button>
      )}
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Strokes a round against tour, over {split.rounds} scored {split.rounds === 1 ? 'round' : 'rounds'}.
      </p>
    </div>
  );
}
