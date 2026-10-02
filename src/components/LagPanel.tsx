import { DANGER_FROM, LAG_FROM, type LagSave } from '../lib/stats';

/**
 * One definition of a bad lag, not two. This card used to carry the tour standard (inside a
 * tenth of the putt) and the danger line (4 feet) side by side, plus an average leave that
 * included the lags you holed. Three numbers answering nearly the same question, disagreeing.
 * The danger line is the one tied to three-putts, so it is the one that stayed.
 */
export function LagPanel({ lag }: { lag: LagSave }) {
  const badPct = lag.lags ? Math.round((lag.bad / lag.lags) * 100) : null;
  const savePct = lag.bad ? Math.round((lag.saved / lag.bad) * 100) : null;

  return (
    <div className="card">
      <div className="stat-row">
        <span className="k">First putts from {LAG_FROM}+ ft</span>
        <span className="v num">{lag.lags}</span>
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
          <span className="k">Average comeback</span>
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
