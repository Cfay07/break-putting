import { useMemo, useState } from 'react';
import { bleedSummary } from '../lib/bleed';
import { DistanceTable } from '../components/DistanceTable';
import { InsightList } from '../components/InsightList';
import { LagPanel } from '../components/LagPanel';
import { PatternPanel } from '../components/PatternPanel';
import { Trend } from '../components/Trend';
import { fmtDate, pctText, signed } from '../lib/format';
import { Bar } from '../components/Bar';
import {
  byCourse,
  courseLabel,
  overall,
  pct,
  roundScale,
  roundStats,
  splitByGreen,
  type Stats as S,
} from '../lib/stats';
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

function sideFromStats(label: string, s: S, scale = 1): Side {
  return {
    label,
    putts: s.totalPutts * scale,
    three: s.threePlus * scale,
    scoring: pct(s.scoring),
    sg: s.sg * scale,
    gir: s.scoredHoles ? s.gir * scale : null,
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
  const taggedRounds = useMemo(
    () => rounds.filter((r) => r.holes.some((h) => h.putts.some((p) => p.missSide))).length,
    [rounds],
  );
  const courses = useMemo(() => byCourse(rounds, state.baseline), [rounds, state.baseline]);
  const bleed = useMemo(() => bleedSummary(rounds), [rounds]);
  const green = useMemo(() => splitByGreen(rounds), [rounds]);
  const withScore = useMemo(
    () =>
      rounds
        .map((r) => ({ r, s: roundStats(r, state.baseline), k: roundScale(r) }))
        .filter((x) => x.r.score !== undefined),
    [rounds, state.baseline],
  );
  const avgScore = withScore.length
    ? withScore.reduce((sum, x) => sum + x.r.score! * x.k, 0) / withScore.length
    : null;
  const avgIfNeutral = withScore.length
    ? withScore.reduce((sum, x) => sum + (x.r.score! + x.s.sg) * x.k, 0) / withScore.length
    : null;
  const anyNine = withScore.some((x) => x.k > 1) || rounds.some((r) => roundScale(r) > 1);

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
    ? sideFromStats(fmtDate(left.date), roundStats(left, state.baseline), roundScale(left))
    : null;
  const rightSide: Side | null = rightRound
    ? sideFromStats(
        fmtDate(rightRound.date),
        roundStats(rightRound, state.baseline),
        roundScale(rightRound),
      )
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
                  That is your scoring average of {avgScore.toFixed(1)} with a tour pro's putting
                  dropped into the same rounds. Strokes gained is always measured against tour, so
                  read the {Math.abs(avgScore - avgIfNeutral).toFixed(1)} as the gap to a pro's
                  putter, not to a decent amateur one.
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
                        {x.r.score! * x.k} <span className="muted">→</span>{' '}
                        {((x.r.score! + x.s.sg) * x.k).toFixed(1)}
                      </span>
                    </div>
                  ))}
                <p className="small muted" style={{ margin: '10px 0 0' }}>
                  {withScore.length > 5 ? `Your last five. The average above uses all ${withScore.length}. ` : ''}
                  {anyNine ? 'A round marked (9) is doubled so it compares to an eighteen.' : ''}
                </p>
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

          {anyNine && (
            <p className="small muted" style={{ marginTop: -4 }}>
              Nine-hole rounds are doubled to compare with an eighteen.
            </p>
          )}

          <h2>By distance</h2>
          <DistanceTable stats={o.pooled} rounds={o.rounds} sgPerRound={o.bucketSgPerRound} />
          <p className="small muted" style={{ marginTop: 6 }}>
            Made and % count every putt as it happened. Each row is rounded to two decimals, so
            adding them by eye can land a hundredth off the total{anyNine ? '. Nine-hole rounds are doubled here the same way as in Averages' : ''}.
          </p>

          <h2>Am I improving</h2>
          {[
            { title: 'Putts per round', values: o.points.map((p) => p.stats.totalPutts * p.scale), invert: true, fmt: (v: number) => v.toFixed(0) },
            { title: '3-putts per round', values: o.points.map((p) => p.stats.threePlus * p.scale), invert: true, fmt: (v: number) => v.toFixed(0) },
            { title: 'Strokes gained per round', values: o.points.map((p) => p.stats.sg * p.scale), invert: false, fmt: (v: number) => signed(v, 2) },
            {
              title: 'Scoring make %',
              values: o.points.map((p) => pct(p.stats.scoring) ?? 0),
              invert: false,
              fmt: (v: number) => `${v.toFixed(0)}%`,
            },
          ].map((chart) => (
            <div className="card trend-card" key={chart.title}>
              <div className="trend-head">
                <span className="tiny">{chart.title}</span>
                <span className="trend-now">
                  <span className="num">{chart.fmt(chart.values[chart.values.length - 1])}</span>
                  <span className="tiny muted">
                    avg {chart.fmt(chart.values.reduce((a, b) => a + b, 0) / chart.values.length)}
                  </span>
                </span>
              </div>
              <Trend values={chart.values} invert={chart.invert} />
            </div>
          ))}
          {anyNine && (
            <p className="small muted" style={{ marginTop: 10 }}>
              A nine-hole round is doubled here, so it sits next to an eighteen fairly. Open the
              round itself to see what it actually was.
            </p>
          )}

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
          {anyNine && (
            <p className="small muted" style={{ marginTop: 6 }}>
              A nine-hole round is doubled on both sides here, so the comparison is like for like.
            </p>
          )}

          <h2>Lag control</h2>
          <LagPanel stats={o.pooled} />

          {green && (
            <>
              <h2>Green hit vs green missed</h2>
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Green</th>
                        <th>Holes</th>
                        <th>1st putt</th>
                        <th>Putts</th>
                        <th>1-putt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        ['Hit', green.hit],
                        ['Missed', green.missed],
                      ] as const).map(([label, side]) => (
                        <tr key={label}>
                          <td>{label}</td>
                          <td>{side.holes}</td>
                          <td>{side.firstPutt} ft</td>
                          <td>{side.puttsPerHole.toFixed(2)}</td>
                          <td>{side.onePuttPct.toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small" style={{ margin: '8px 0 0' }}>
                  You one-putt {green.hit.onePuttPct.toFixed(0)}% of the greens you hit and{' '}
                  {green.missed.onePuttPct.toFixed(0)}% of the ones you miss. That gap is distance.
                  Your first putt is a median {green.hit.firstPutt} ft when you hit the green and{' '}
                  {green.missed.firstPutt} ft when you miss it, and your make rate falls off a cliff
                  past five feet.
                </p>

                {(() => {
                  const m = green.missed;
                  const made = (m.makes / m.attempts) * 100;
                  const normal = (m.expected / m.attempts) * 100;
                  const gap = made - normal;
                  const floor = ((2 * m.se) / m.attempts) * 100;
                  return (
                    <>
                      <div className="field-label">Same putts, matched foot for foot</div>
                      <Bar
                        label="What you made"
                        value={`${made.toFixed(1)}%`}
                        ratio={made / 100}
                        warn={gap < -floor}
                        wide
                      />
                      <Bar
                        label="Your normal"
                        value={`${normal.toFixed(1)}%`}
                        ratio={normal / 100}
                        wide
                      />
                      <p className="small" style={{ margin: '6px 0 0' }}>
                        {Math.abs(gap) < floor
                          ? 'Dead even. Once the distance is matched your stroke is the same either way, so the pressure is not the problem. How far away you are when you hit a green is.'
                          : gap < 0
                            ? `You make ${Math.abs(gap).toFixed(1)} points fewer when you are scrambling. The par putt is getting to you.`
                            : `You make ${gap.toFixed(1)} points more when you are scrambling. You putt better with something to save.`}
                      </p>
                      <p className="small muted" style={{ margin: '6px 0 0' }}>
                        Your normal is what your own make rate from those exact distances says
                        you should have made. The gap has to clear {floor.toFixed(1)} points before
                        it means anything, off {m.attempts} putts. This test is weak either way:
                        the two groups barely sit at the same distances, so there is not much to
                        match on.
                      </p>
                    </>
                  );
                })()}
              </div>
            </>
          )}

          <h2>Miss patterns</h2>
          <PatternPanel stats={o.pooled} taggedRounds={taggedRounds} />

          {bleed.count > 0 && (
            <>
              <h2>Bleed</h2>
              <div className="card">
                <div className="shoot-for num neg">{bleed.shotsPerRound?.toFixed(1)}</div>
                <p className="small" style={{ margin: '4px 0 0' }}>
                  Shots a round you drop on the holes that follow a putting mistake. That is on
                  top of what the mistake itself already cost you.
                </p>
                <p className="small muted" style={{ margin: '6px 0 0' }}>
                  A mistake is a three-putt, or a putt missed from three to six feet on a hole you
                  went over par on. The bleed runs until you play one at par or better.
                </p>

                {bleed.afterRate !== null && bleed.normalRate !== null && (
                  <>
                    <div className="field-label">Par or better on the next hole</div>
                    <Bar
                      label="After a mistake"
                      value={`${(bleed.afterRate * 100).toFixed(0)}%`}
                      ratio={bleed.afterRate}
                      warn={bleed.afterRate < bleed.normalRate}
                      wide
                    />
                    <Bar
                      label="Any other hole"
                      value={`${(bleed.normalRate * 100).toFixed(0)}%`}
                      ratio={bleed.normalRate}
                      wide
                    />
                    <p className="small muted" style={{ margin: '6px 0 0' }}>
                      {bleed.afterRate < bleed.normalRate
                        ? `Right after a mistake you save the hole ${Math.round(bleed.afterRate * 100)} times in 100 instead of ${Math.round(bleed.normalRate * 100)}.`
                        : 'A mistake does not follow you to the next hole.'}
                    </p>
                  </>
                )}

                <div className="field-label">The mistakes themselves</div>
                <div className="stat-row">
                  <span className="k">How many a round</span>
                  <span className="v num">{bleed.perRound?.toFixed(1)}</span>
                </div>
                {bleed.worst && (
                  <div className="stat-row">
                    <span className="k">
                      Worst one{' '}
                      <span className="muted">
                        {fmtDate(bleed.worst.date)}, hole {bleed.worst.triggerHole}
                      </span>
                    </span>
                    <span className="v num neg">+{bleed.worst.shots} after</span>
                  </div>
                )}

                <p className="small muted" style={{ margin: '12px 0 0' }}>
                  Based on {bleed.sample} holes played after a mistake.
                  {bleed.sample < 200
                    ? ' A gap this size needs a few hundred before it proves anything, so read it as a hint.'
                    : ''}
                </p>
              </div>
            </>
          )}

          <h2>By putter</h2>
          {anyNine && (
            <p className="small muted" style={{ margin: '0 0 6px' }}>
              Per eighteen holes, so a nine-hole round counts double.
            </p>
          )}
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Putter</th>
                <th>Rds</th>
                <th>Putts</th>
                <th>3P</th>
                <th>3-10 ft</th>
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
          <InsightList
            stats={o.pooled}
            rounds={o.rounds}
            threePuttsPerRound={o.threePuttsPerRound}
            taggedRounds={taggedRounds}
          />
        </>
      )}
    </>
  );
}
