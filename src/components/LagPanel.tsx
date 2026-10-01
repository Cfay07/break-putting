import { DANGER_FROM, LAG_FROM, type LagSave, type Stats } from '../lib/stats';

export function LagPanel({ stats, lag }: { stats: Stats; lag: LagSave }) {
  const inside = stats.lagAttempts ? (stats.lagInside / stats.lagAttempts) * 100 : null;
  return (
    <div className="card">
      <div className="stat-row">
        <span className="k">First putts from {LAG_FROM}+ ft</span>
        <span className="v num">{stats.lagAttempts}</span>
      </div>
      <div className="stat-row">
        <span className="k">Inside a tenth of the putt</span>
        <span className={inside !== null && inside < 50 ? 'v num neg' : 'v num'}>
          {inside === null ? '--' : `${stats.lagInside} of ${stats.lagAttempts}`}
        </span>
      </div>
      <div className="stat-row">
        <span className="k">Average leave</span>
        <span className="v num">{stats.avgLeave === null ? '--' : `${stats.avgLeave.toFixed(1)} ft`}</span>
      </div>
      <div className="stat-row">
        <span className="k">Average leave as % of putt</span>
        <span className={stats.avgLeavePct !== null && stats.avgLeavePct > 10 ? 'v num neg' : 'v num'}>
          {stats.avgLeavePct === null ? '--' : `${stats.avgLeavePct.toFixed(0)}%`}
        </span>
      </div>
      {lag.bad > 0 && (
        <>
          <div className="stat-row">
            <span className="k">Left outside {DANGER_FROM} ft</span>
            <span className={lag.lags && lag.bad / lag.lags > 0.3 ? 'v num neg' : 'v num'}>
              {lag.bad} of {lag.lags}
            </span>
          </div>
          <div className="stat-row">
            <span className="k">Two-putt saved from there</span>
            <span className={lag.saved / lag.bad < 0.6 ? 'v num neg' : 'v num pos'}>
              {Math.round((lag.saved / lag.bad) * 100)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
