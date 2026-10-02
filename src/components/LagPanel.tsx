import { DANGER_FROM, LAG_FROM, type LagSave, type Stats } from '../lib/stats';

/**
 * Reads top to bottom as one sequence: what you typically leave, how often that is trouble, how
 * bad it is when it is, whether you save it. The order is what tells you the leave and the
 * comeback are not the same number, which two flat rows labelled "average" never did.
 */
export function LagPanel({ stats, lag }: { stats: Stats; lag: LagSave }) {
  const badPct = lag.lags ? Math.round((lag.bad / lag.lags) * 100) : null;
  const savePct = lag.bad ? Math.round((lag.saved / lag.bad) * 100) : null;

  return (
    <div className="card">
      <div className="stat-row">
        <span className="k">First putts from {LAG_FROM}+ ft</span>
        <span className="v num">{lag.lags}</span>
      </div>
      <div className="stat-row">
        <span className="k">Typical leave</span>
        <span className="v num">
          {stats.avgLeave === null ? '--' : `${stats.avgLeave.toFixed(1)} ft`}
          {stats.avgLeavePct !== null && (
            <span className={stats.avgLeavePct > 10 ? 'small neg' : 'small muted'}>
              {' '}· {stats.avgLeavePct.toFixed(0)}% of the putt
            </span>
          )}
        </span>
      </div>
      <div className="stat-row">
        <span className="k">Left yourself {DANGER_FROM}+ ft</span>
        <span className={badPct !== null && badPct > 30 ? 'v num neg' : 'v num'}>
          {badPct === null ? '--' : `${badPct}%`}
          <span className="small muted"> · {lag.bad} of {lag.lags}</span>
        </span>
      </div>
      {lag.avgBadLeave !== null && (
        <div className="stat-row">
          <span className="k">When you did, the comeback</span>
          <span className="v num">{lag.avgBadLeave.toFixed(1)} ft</span>
        </div>
      )}
      {savePct !== null && (
        <div className="stat-row">
          <span className="k">Holed it</span>
          <span className={savePct < 60 ? 'v num neg' : 'v num pos'}>
            {savePct}%
            <span className="small muted"> · {lag.saved} of {lag.bad}</span>
          </span>
        </div>
      )}
    </div>
  );
}
