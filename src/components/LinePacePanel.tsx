import type { LineAndPace } from '../lib/stats';

const MIN_JUDGED = 20;

/**
 * Line and pace are the two halves of every putt, and the miss grid records both in one tap, so
 * they belong side by side. Deliberately two numbers and a sentence: this sits between Lag
 * control and By green speed and has to stay small.
 */
export function LinePacePanel({ lp }: { lp: LineAndPace }) {
  if (lp.readJudged < MIN_JUDGED && lp.paceJudged < MIN_JUDGED) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        Tag the side and pace on a few more misses and this turns on. It needs {MIN_JUDGED} judged
        putts and has {Math.max(lp.readJudged, lp.paceJudged)}.
      </p>
    );
  }

  const read = lp.readJudged ? Math.round((lp.readRight / lp.readJudged) * 100) : null;
  const pace = lp.paceJudged ? Math.round((lp.paceRight / lp.paceJudged) * 100) : null;
  const worse = read !== null && pace !== null ? (read < pace ? 'line' : 'pace') : null;

  return (
    <div>
      <div className="lp-grid">
        <div className="lp-cell">
          <span className="tiny">Read right</span>
          <span className="lp-val">{read === null ? '--' : `${read}%`}</span>
          <span className="small muted">
            {lp.readRight} of {lp.readJudged}
          </span>
        </div>
        <div className="lp-cell">
          <span className="tiny">Pace right</span>
          <span className="lp-val">{pace === null ? '--' : `${pace}%`}</span>
          <span className="small muted">
            {lp.paceRight} of {lp.paceJudged}
          </span>
        </div>
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Holed, or missed on the right line and at the right pace. Your {worse} is the weaker half
        {lp.short + lp.long > 0
          ? `, and of the pace misses ${lp.short >= lp.long ? `${lp.short} came up short` : `${lp.long} ran past`} against ${lp.short >= lp.long ? lp.long : lp.short} the other way`
          : ''}
        .
      </p>
    </div>
  );
}
