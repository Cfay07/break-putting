import { MIN_PAIRS, type Drift } from '../lib/drift';

/**
 * How sure the number is, said in words. A z of 2 is the usual line for "this is probably not
 * chance", and anything under it gets told on itself rather than dressed up.
 */
function confidence(z: number): string {
  const a = Math.abs(z);
  if (a >= 2.6) return 'Very unlikely to be chance.';
  if (a >= 2) return 'Unlikely to be chance.';
  if (a >= 1.5) return 'Suggestive, not proven yet.';
  return 'Too close to a coin flip to call.';
}

export function DriftPanel({ drift }: { drift: Drift }) {
  if (drift.rate === null || drift.z === null) {
    return (
      <div className="card">
        <p className="small muted" style={{ margin: 0 }}>
          {drift.pairs} of the {MIN_PAIRS} back-to-back misses needed. Tag which side your misses
          finish on and this fills in.
        </p>
      </div>
    );
  }

  const pct = Math.round(drift.rate * 100);
  const leans = drift.z >= 1.5;

  return (
    <div>
      <div className="card">
        <div className="stat-row">
          <span className="k">Next miss goes the same way</span>
          <span className={leans ? 'v num neg' : 'v num'}>{pct}%</span>
        </div>
        <div className="stat-row">
          <span className="k">If misses were independent</span>
          <span className="v num">50%</span>
        </div>
        <div className="stat-row">
          <span className="k">Back-to-back misses measured</span>
          <span className="v num">{drift.pairs}</span>
        </div>
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        {confidence(drift.z)}{' '}
        {leans
          ? 'Your misses are not independent. When one goes high the next one tends to go high as well, so a miss is worth treating as information about the next green rather than bad luck on this one.'
          : 'Your misses land either side at about the rate chance would produce, so a miss says nothing about the next one.'}
      </p>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        Only misses on different greens count. Missing high twice on one hole is one misread seen
        twice, not something carrying across the round.
      </p>
    </div>
  );
}
