import { useMemo, useState } from 'react';
import { DistanceTable } from '../components/DistanceTable';
import { InsightList } from '../components/InsightList';
import { LagPanel } from '../components/LagPanel';
import { PatternPanel } from '../components/PatternPanel';
import { Trend } from '../components/Trend';
import { fmtDate, pctText, signed } from '../lib/format';
import { byCourse, courseLabel, overall, pct, roundStats, type Stats as S } from '../lib/stats';
import { useApp } from '../lib/store';

const AVG = '__avg__';

interface Side {
  label: string;
  putts: number | null;
  three: number | null;
  scoring: number | null;
  sg: number | null;
  gir: number | null;
}

function sideFromStats(label: string, s: S): Side {
  return {
    label,
    putts: s.totalPutts,
    three: s.threePlus,
    scoring: pct(s.scoring),
    sg: s.sg,
    gir: s.scoredHoles ? s.gir : null,
  };
}

export function Stats() {
  const { state } = useApp();
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState(AVG);

  const rounds = useMemo(
    () =>
      state.rounds
        .filter((r) => r.finished)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [state.rounds],
  );

  const o = useMemo(() => overall(rounds, state.baseline), [rounds, state.baseline]);
  const courses = useMemo(() => byCourse(rounds, state.baseline), [rounds, state.baseline]);
  const withScore = useMemo(
    () => rounds.map((r) => ({ r, s: roundStats(r, state.baseline) })).filter((x) => x.r.score !== undefined),
    [rounds, state.baseline],
  );
  const avgScore = withScore.length
    ? withScore.reduce((sum, x) => sum + x.r.score!, 0) / withScore.length
    : null;
  const avgIfNeutral = withScore.length
    ? withScore.reduce((sum, x) => sum + x.r.score! + x.s.sg, 0) / withScore.length
    : null;

  if (state.rounds.filter((r) => r.finished).length === 0) {
    return (
      <div className="empty">
        <p>Nothing to compare yet. Finish a round and this page turns on.</p>
      </div>
    );
  }

  const latest = rounds[rounds.length - 1];
  const left = leftId
    ? rounds.find((r) => r.id === leftId)
    : latest;
  const rightRound = rightId === AVG ? null : rounds.find((r) => r.id === rightId);

  const leftSide: Side | null = left
    ? sideFromStats(fmtDate(left.date), roundStats(left, state.baseline))
    : null;
  const rightSide: Side | null = rightRound
    ? sideFromStats(fmtDate(rightRound.date), roundStats(rightRound, state.baseline))
    : {
        label: `Average of ${o.rounds}`,
        putts: o.puttsPerRound,
        three: o.threePuttsPerRound,
        scoring: o.scoringPct,
        sg: o.sgPerRound,
        gir: o.girPerRound,
      };

  const rows: {
    k: string;
    get: (s: Side) => number | null;
    lowerBetter: boolean;
    fmt: (v: number) => string;
    dfmt: (v: number) => string;
  }[] = [
    { k: 'Putts', get: (s) => s.putts, lowerBetter: true, fmt: (v) => v.toFixed(1), dfmt: (v) => v.toFixed(1) },
    { k: '3-putts', get: (s) => s.three, lowerBetter: true, fmt: (v) => v.toFixed(1), dfmt: (v) => v.toFixed(1) },
    {
      k: 'Scoring make %',
      get: (s) => s.scoring,
      lowerBetter: false,
      fmt: (v) => `${v.toFixed(0)}%`,
      dfmt: (v) => `${v.toFixed(0)}%`,
    },
    { k: 'Strokes gained', get: (s) => s.sg, lowerBetter: false, fmt: (v) => signed(v, 2), dfmt: (v) => v.toFixed(2) },
    { k: 'Greens hit', get: (s) => s.gir, lowerBetter: false, fmt: (v) => v.toFixed(1), dfmt: (v) => v.toFixed(1) },
  ];

  return (
    <>
      {o.rounds === 0 ? (
        <div className="empty">
          <p style={{ margin: 0 }}>No rounds match those filters.</p>
        </div>
      ) : (
        <>
          {avgScore !== null && avgIfNeutral !== null && (
            <>
              <h2>What you would be shooting</h2>
              <div className="card">
                <div className="shoot-for num">{avgIfNeutral.toFixed(1)}</div>
                <p className="small" style={{ margin: '4px 0 12px' }}>
                  That is your scoring average of {avgScore.toFixed(1)} with the putter taken out of it.
                  Putting is costing you {Math.abs(avgScore - avgIfNeutral).toFixed(1)} shots a round.
                </p>
                {withScore
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((x) => (
                    <div className="stat-row" key={x.r.id}>
                      <span className="k">
                        {fmtDate(x.r.date)}
                        {x.r.course ? ` · ${courseLabel(x.r)}` : ''}
                      </span>
                      <span className="v num" style={{ whiteSpace: 'nowrap' }}>
                        {x.r.score} <span className="muted">→</span>{' '}
                        {(x.r.score! + x.s.sg).toFixed(1)}
                      </span>
                    </div>
                  ))}
                {withScore.length > 5 && (
                  <p className="small muted" style={{ margin: '10px 0 0' }}>
                    Your last five. The average above uses all {withScore.length}.
                  </p>
                )}
              </div>
            </>
          )}

          <h2>Averages</h2>
          <div className="card">
            <div className="stat-row">
              <span className="k">Putts per round</span>
              <span className="v num">{o.puttsPerRound?.toFixed(1)}</span>
            </div>
            <div className="stat-row">
              <span className="k">3-putts per round</span>
              <span className={(o.threePuttsPerRound ?? 0) > 0 ? 'v num neg' : 'v num'}>
                {o.threePuttsPerRound?.toFixed(2)}
              </span>
            </div>
            <div className="stat-row">
              <span className="k">Scoring make % (3-10 ft)</span>
              <span className="v num">{pctText(o.scoringPct)}</span>
            </div>
            <div className="stat-row">
              <span className="k">Strokes gained per round</span>
              <span className={(o.sgPerRound ?? 0) >= 0 ? 'v num pos' : 'v num neg'}>
                {signed(o.sgPerRound ?? 0, 2)}
              </span>
            </div>
            {o.girPerRound !== null && (
              <div className="stat-row">
                <span className="k">Greens in regulation per round</span>
                <span className="v num">{o.girPerRound.toFixed(1)}</span>
              </div>
            )}
          </div>

          <h2>By distance</h2>
          <DistanceTable stats={o.pooled} rounds={o.rounds} />

          <h2>Am I improving</h2>
          {[
            { title: 'Putts per round', values: o.points.map((p) => p.stats.totalPutts), invert: true, fmt: (v: number) => v.toFixed(0) },
            { title: '3-putts per round', values: o.points.map((p) => p.stats.threePlus), invert: true, fmt: (v: number) => v.toFixed(0) },
            { title: 'Strokes gained per round', values: o.points.map((p) => p.stats.sg), invert: false, fmt: (v: number) => signed(v, 2) },
            {
              title: 'Scoring make %',
              values: o.points.map((p) => pct(p.stats.scoring) ?? 0),
              invert: false,
              fmt: (v: number) => `${v.toFixed(0)}%`,
            },
          ].map((chart) => (
            <div className="card" key={chart.title}>
              <div className="round-head">
                <span className="tiny">{chart.title}</span>
                <span className="num" style={{ fontWeight: 700 }}>
                  {chart.fmt(chart.values[chart.values.length - 1])}
                </span>
              </div>
              <Trend values={chart.values} invert={chart.invert} />
            </div>
          ))}

          <h2>Round vs round</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <select value={left?.id ?? ''} onChange={(e) => setLeftId(e.target.value)} aria-label="left round">
              {rounds
                .slice()
                .reverse()
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {fmtDate(r.date)} · {courseLabel(r)}
                  </option>
                ))}
            </select>
            <select value={rightId} onChange={(e) => setRightId(e.target.value)} aria-label="right round">
              <option value={AVG}>My average</option>
              {rounds
                .slice()
                .reverse()
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {fmtDate(r.date)} · {courseLabel(r)}
                  </option>
                ))}
            </select>
          </div>
          {leftSide && rightSide && (
            <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>{leftSide.label}</th>
                  <th>{rightSide.label}</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const a = row.get(leftSide);
                  const b = row.get(rightSide);
                  if (a === null || b === null) return null;
                  const delta = a - b;
                  const better = row.lowerBetter ? delta < 0 : delta > 0;
                  const flat = Math.abs(delta) < 0.005;
                  return (
                    <tr key={row.k}>
                      <td>{row.k}</td>
                      <td>{row.fmt(a)}</td>
                      <td>{row.fmt(b)}</td>
                      <td className={flat ? '' : better ? 'pos' : 'neg'}>
                        {flat ? '=' : `${delta > 0 ? '▲' : '▼'} ${row.dfmt(Math.abs(delta))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}

          <h2>Lag control</h2>
          <LagPanel stats={o.pooled} />

          <h2>Miss patterns</h2>
          <PatternPanel stats={o.pooled} />

          <h2>By putter</h2>
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Putter</th>
                <th>Rds</th>
                <th>Putts</th>
                <th>3P</th>
                <th>4-10 ft</th>
                <th>SG</th>
              </tr>
            </thead>
            <tbody>
              {state.putters.map((p) => {
                const sub = overall(
                  rounds.filter((r) => r.putterId === p.id),
                  state.baseline,
                );
                if (!sub.rounds) return null;
                return (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      {p.active && <span className="small muted"> · in the bag</span>}
                    </td>
                    <td>{sub.rounds}</td>
                    <td>{sub.puttsPerRound?.toFixed(1)}</td>
                    <td>{sub.threePuttsPerRound?.toFixed(2)}</td>
                    <td>{pctText(sub.scoringPct)}</td>
                    <td className={(sub.sgPerRound ?? 0) >= 0 ? 'pos' : 'neg'}>
                      {signed(sub.sgPerRound ?? 0, 2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {courses.length > 0 && (
            <>
              <h2>By course</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Rds</th>
                      <th>Putts</th>
                      <th>3P</th>
                      <th>SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.slice(0, 8).map((c) => (
                      <tr key={c.label}>
                        <td>{c.label}</td>
                        <td>{c.rounds}</td>
                        <td>{c.putts.toFixed(1)}</td>
                        <td>{c.threePlus.toFixed(1)}</td>
                        <td className={c.sg >= 0 ? 'pos' : 'neg'}>{signed(c.sg, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">
                Per eighteen holes, so nine-hole rounds count double.
                {courses.length > 8 ? ` Most played eight of ${courses.length}.` : ''}
              </p>
            </>
          )}

          <h2>What to work on</h2>
          <InsightList stats={o.pooled} />
        </>
      )}
    </>
  );
}
