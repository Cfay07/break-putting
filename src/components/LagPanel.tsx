import { LAG_FROM, type LagSave, type Stats } from '../lib/stats';

/**
 * Reads top to bottom as one story: how many lags, where they finished on average, how many were
 * good for their length, and what the rest cost. A good lag is judged against its own length, a
 * tenth of the putt, so a 4 footer counts as good from 40 and not from 30.
 */
export function LagPanel({ stats, lag }: { stats: Stats; lag: LagSave }) {
  const goodShare = lag.lags ? lag.good / lag.lags : null;
  const holedShare = lag.comebacks ? lag.comebacksHoled / lag.comebacks : null;

  return (
    <div className="card">
      <div className="stat-row">
        <span className="k">Lags from {LAG_FROM}+ ft</span>
        <span className="v num">{lag.lags}</span>
      </div>
      <div className="stat-row">
        <span className="k">Average leave</span>
        <span className="v num">{stats.avgLeave === null ? '--' : `${stats.avgLeave.toFixed(1)} ft`}</span>
      </div>
      <div className="stat-row">
        <span className="k">Inside 10% of the putt</span>
        <span className={goodShare !== null && goodShare >= 0.5 ? 'v num pos' : 'v num'}>
          {lag.good} of {lag.lags}
        </span>
      </div>
      {lag.avgComeback !== null && (
        <div className="stat-row">
          <span className="k">The rest left a comeback</span>
          <span className="v num">
            {lag.avgComeback.toFixed(1)} ft<span className="small muted"> on average</span>
          </span>
        </div>
      )}
      {holedShare !== null && (
        <div className="stat-row">
          <span className="k">Comebacks holed</span>
          <span className={holedShare === 1 ? 'v num pos' : holedShare < 0.6 ? 'v num neg' : 'v num'}>
            {lag.comebacksHoled} of {lag.comebacks}
          </span>
        </div>
      )}
    </div>
  );
}
