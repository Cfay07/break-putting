import { go } from '../lib/router';
import {
  bestLags,
  lagByLength,
  lagBySlope,
  lagsOf,
  lagTrend,
  TREND_MIN_LAGS,
  TREND_ROUNDS,
  worstLags,
  type Lag,
  type LagSplit,
  type TrendPoint,
} from '../lib/lagStory';
import { brandPill, type Putter, type Round } from '../lib/types';

const pct = (x: number) => Math.round(x * 100);
const day = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const W = 330;
const H = 140;
const PAD = { l: 26, r: 8, t: 12, b: 24 };

/** Inside-10% over the last five rounds at each round, with the day each putter came in marked. */
function TrendChart({ points, putters }: { points: TrendPoint[]; putters: Putter[] }) {
  const x = (i: number) => PAD.l + (i / Math.max(1, points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (r: number) => PAD.t + (1 - r) * (H - PAD.t - PAD.b);
  const low = points.reduce((m, p, i) => (p.rate < points[m].rate ? i : m), 0);
  const last = points.length - 1;
  const switches = points
    .map((p, i) => ({ i, p }))
    .filter(({ i, p }) => i > 0 && p.putterId !== points[i - 1].putterId)
    .map(({ i, p }) => {
      const name = putters.find((q) => q.id === p.putterId)?.name ?? '';
      return { i, name: name.split(' ')[0], color: brandPill(name)?.bg ?? '#14392b' };
    });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`Inside 10% over your last ${TREND_ROUNDS} rounds, from ${pct(points[0].rate)}% on ${day(points[0].date)} to ${pct(points[last].rate)}% on ${day(points[last].date)}`}
    >
      {[0, 0.5, 1].map((r) => (
        <g key={r}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(r)} y2={y(r)} stroke="rgba(20,57,43,.08)" />
          <text x={PAD.l - 4} y={y(r) + 3} fontSize="10" textAnchor="end" fill="var(--ink-3)">
            {r * 100}
          </text>
        </g>
      ))}
      {switches.map((s) => (
        <g key={s.i}>
          <line x1={x(s.i)} x2={x(s.i)} y1={PAD.t - 4} y2={H - PAD.b} stroke={s.color} strokeDasharray="3 3" />
          <text x={x(s.i) + 4} y={PAD.t + 6} fontSize="10" fontWeight="700" fill={s.color}>
            {s.name}
          </text>
        </g>
      ))}
      <polyline
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        points={points.map((p, i) => `${x(i)},${y(p.rate)}`).join(' ')}
      />
      {low !== last && <circle cx={x(low)} cy={y(points[low].rate)} r="4" fill="#a52a1f" />}
      <circle cx={x(last)} cy={y(points[last].rate)} r="4" fill="#2e8a5c" />
      <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--ink-3)">
        {day(points[0].date)}
      </text>
      <text x={W - PAD.r} y={H - 6} fontSize="10" textAnchor="end" fill="var(--ink-3)">
        {day(points[last].date)}
      </text>
    </svg>
  );
}

function Splits({ rows }: { rows: LagSplit[] }) {
  const rates = rows.map((r) => r.good / r.lags);
  const best = Math.max(...rates);
  const worst = Math.min(...rates);
  // Colour only a real gap, so two rates a putt or two apart are not painted as a finding.
  const tone = (r: number) => (best - worst < 0.15 ? '' : r === best ? 'pos' : r === worst ? 'neg' : '');
  return (
    <div className="card">
      {rows.map((r, i) => (
        <div className="stat-row" key={r.label}>
          <span className="k">{r.label}</span>
          <span className={`v num ${tone(rates[i])}`}>
            {r.good} of {r.lags} · {pct(rates[i])}%
            <span className="small muted"> · leave {r.avgLeave.toFixed(1)} ft</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function LagList({ lags, bad }: { lags: Lag[]; bad?: boolean }) {
  return (
    <div className="card">
      {lags.map((l) => (
        <button
          key={`${l.roundId}-${l.hole}`}
          className="lag-pick"
          onClick={() => go(`/round/${l.roundId}/hole/${l.hole}`)}
        >
          <span className={bad ? 'lp-d num neg' : 'lp-d num'}>
            {l.leave === 0 ? `${l.d} ft · in` : `${l.d} → ${l.leave} ft`}
          </span>
          <span className="lp-w">
            <b>
              {l.course || 'Round'}, hole {l.hole}
            </b>
            <small>
              {day(l.date)}
              {l.putts >= 3 ? ` · ${l.putts} putts` : ''}
              {l.uphill ? ' · uphill' : l.downhill ? ' · downhill' : ''}
            </small>
          </span>
          <span className="chev">›</span>
        </button>
      ))}
    </div>
  );
}

/** The rest of the lag page: how it moved, what it is made of, and the lags that tell the story. */
export function LagStory({
  rounds,
  putters,
  practice,
}: {
  rounds: Round[];
  putters: Putter[];
  practice: { label: string; start: () => void } | null;
}) {
  const lags = lagsOf(rounds);
  const points = lagTrend(rounds);
  const length = lagByLength(lags);
  const slope = lagBySlope(lags);
  const best = bestLags(lags);
  const worst = worstLags(lags);
  return (
    <>
      <div className="field-label">Over time</div>
      {points.length >= 2 ? (
        <div className="card" style={{ padding: 12 }}>
          <TrendChart points={points} putters={putters} />
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            Inside 10% over your last {TREND_ROUNDS} rounds at each point, starting once {TREND_MIN_LAGS} lags are
            behind it. A dashed line is the day a new putter came in.
          </p>
        </div>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          Shows once {TREND_MIN_LAGS} lags sit inside {TREND_ROUNDS} rounds, twice. You have {lags.length} lags.
        </p>
      )}

      {length.length > 0 && (
        <>
          <div className="field-label">By length</div>
          <Splits rows={length} />
        </>
      )}
      {slope.length > 0 && (
        <>
          <div className="field-label">Uphill or downhill</div>
          <Splits rows={slope} />
        </>
      )}
      {best.length > 0 && (
        <>
          <div className="field-label">Your best</div>
          <LagList lags={best} />
        </>
      )}
      {worst.length > 0 && (
        <>
          <div className="field-label">Your worst</div>
          <LagList lags={worst} bad />
        </>
      )}
      {practice && (
        <button className="btn btn-primary btn-wide" style={{ marginTop: 16 }} onClick={practice.start}>
          {practice.label}
        </button>
      )}
    </>
  );
}
