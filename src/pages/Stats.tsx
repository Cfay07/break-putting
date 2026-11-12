import { useMemo, useState } from 'react';
import { bleedSummary } from '../lib/bleed';
import { fitMakeModel } from '../lib/makeability';
import { formTrial } from '../lib/formTrial';
import { formOf, formBand } from '../lib/form';
import {
  cupUse,
  readBias,
  roomSpare,
  ROOM_MAX,
  VERDICT_LABEL,
  verdictTally,
  beatSpread,
} from '../lib/xp';
import { DistanceTable } from '../components/DistanceTable';
import { InsightList } from '../components/InsightList';
import { LagPanel } from '../components/LagPanel';
import { MissAnatomyPanel } from '../components/MissAnatomyPanel';
import { MissShapesPanel } from '../components/MissShapesPanel';
import { ReadPanel } from '../components/ReadPanel';
import { readError } from '../lib/readError';
import { StrikePanel } from '../components/StrikePanel';
import { SampleTag } from '../components/SampleTag';
import { SectionNav } from '../components/SectionNav';
import { CupMap } from '../components/CupMap';
import { Why } from '../components/Why';
import { BeatBar } from '../components/BeatBar';
import { sample, signedFor } from '../lib/sample';
import { byStrike } from '../lib/stats';
import { LearnedPanel } from '../components/LearnedPanel';
import { PatternPanel } from '../components/PatternPanel';
import { SpeedPanel } from '../components/SpeedPanel';
import { StatsFilter } from '../components/StatsFilter';
import { PracticeStats } from './PracticeStats';
import { applyFilter, filterLabel, isFiltered, NO_FILTER, type RoundFilter } from '../lib/roundFilter';
import { Trend } from '../components/Trend';
import { StandCard } from '../components/StandCard';
import { useCourseRatings } from '../lib/useCourseRatings';
import { fmtDate, pctText, signed } from '../lib/format';
import { Bar } from '../components/Bar';
import {
  byGreenSpeed,
  DANGER_FROM,
  lagSaves,
  missAnatomy,
  missShapes,
  volatility,
  overall,
  pct,
  roundScale,
  roundStats,
} from '../lib/stats';
import { useApp } from '../lib/store';

/** Rounds or practice. Two views of the same tab that never share a number. */
function StatsSwitch({ practice }: { practice: boolean }) {
  return (
    <div className="seg seg-quiet" role="group" aria-label="Which stats" style={{ marginBottom: 12 }}>
      <a className="seg-link" aria-current={!practice} href="#/stats">
        Rounds
      </a>
      <a className="seg-link" aria-current={practice} href="#/stats/practice">
        Practice
      </a>
    </div>
  );
}

export function Stats({ practice = false }: { practice?: boolean }) {
  if (practice) {
    return (
      <div>
        <StatsSwitch practice />
        <PracticeStats />
      </div>
    );
  }
  return <RoundStats />;
}

function RoundStats() {
  const { state } = useApp();
  const courses = useCourseRatings();
  const [filter, setFilter] = useState<RoundFilter>(NO_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);

  const rounds = useMemo(
    () => applyFilter(state.rounds, filter).sort((a, b) => a.date.localeCompare(b.date)),
    [state.rounds, filter],
  );

  const o = useMemo(() => overall(rounds, state.baseline), [rounds, state.baseline]);
  const taggedRounds = useMemo(
    () => rounds.filter((r) => r.holes.some((h) => h.putts.some((p) => p.missSide))).length,
    [rounds],
  );
  const makeModel = useMemo(() => fitMakeModel(rounds), [rounds]);
  const spread = useMemo(() => beatSpread(state.baseline, rounds), [state.baseline, rounds]);
  const cup = useMemo(() => cupUse(rounds), [rounds]);
  const bias = useMemo(() => readBias(rounds), [rounds]);
  const room = useMemo(() => roomSpare(rounds), [rounds]);
  const verdicts = useMemo(
    () => verdictTally(makeModel, state.baseline, rounds),
    [makeModel, state.baseline, rounds],
  );
  const speeds = useMemo(() => byGreenSpeed(rounds, state.baseline), [rounds, state.baseline]);
  const lag = useMemo(() => lagSaves(rounds), [rounds]);
  const read = useMemo(() => readError(rounds), [rounds]);
  const strike = useMemo(() => byStrike(rounds), [rounds]);
  const trial = useMemo(() => formTrial(rounds, state.baseline), [rounds, state.baseline]);

  /** Season Form. Rounds with no putts return null and simply do not count. */
  const form = useMemo(() => {
    const all = rounds.map((r) => formOf(r, state.baseline)).filter((f) => f !== null);
    if (!all.length) return null;
    const measured = all.filter((f) => f.process !== null);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return {
      rounds: all.length,
      avg: mean(all.map((f) => f.score)),
      best: Math.max(...all.map((f) => f.score)),
      worst: Math.min(...all.map((f) => f.score)),
      measured: measured.length,
      process: measured.length ? mean(measured.map((f) => f.process!)) : null,
      outcome: mean(all.map((f) => f.outcome)),
    };
  }, [rounds, state.baseline]);

  const miss = useMemo(() => missAnatomy(rounds), [rounds]);
  const shapes = useMemo(() => missShapes(rounds), [rounds]);
  const vol = useMemo(() => volatility(rounds, state.baseline), [rounds, state.baseline]);
  const bleed = useMemo(() => bleedSummary(rounds), [rounds]);
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
  const anyShort = withScore.some((x) => x.k > 1) || rounds.some((r) => roundScale(r) > 1);

  if (state.rounds.filter((r) => r.finished).length === 0) {
    return (
      <div className="empty">
        <p>
          Finish a round and this page turns on: strokes gained, your make rate at every distance,
          where your misses go, and what a three-putt costs you over the holes that follow.
        </p>
      </div>
    );
  }

  return (
    <div id="stats-root">
      <StatsSwitch practice={false} />
      <button className={isFiltered(filter) ? 'filter-bar on' : 'filter-bar'} onClick={() => setFilterOpen(true)}>
        <span className="filter-bar-k">Showing</span>
        <span className="filter-bar-v">{filterLabel(filter, state.putters)}</span>
        <span className="filter-bar-n">{rounds.length} {rounds.length === 1 ? 'round' : 'rounds'}</span>
      </button>
      <SectionNav scope="#stats-root" />

      {filterOpen && (
        <StatsFilter
          value={filter}
          rounds={state.rounds}
          putters={state.putters}
          onChange={setFilter}
          onClose={() => setFilterOpen(false)}
        />
      )}
      {o.rounds === 0 ? (
        <div className="empty">
          <p style={{ margin: '0 0 10px' }}>No rounds match {filterLabel(filter, state.putters).toLowerCase()}.</p>
          <button className="btn btn-ghost" onClick={() => setFilter(NO_FILTER)}>
            Show all rounds
          </button>
        </div>
      ) : (
        <>
          <p className="act">Where you stand</p>
          {avgScore !== null && avgIfNeutral !== null && (
            <>
              <h2>What you would be shooting</h2>
              <StandCard
                rounds={rounds}
                everyRound={state.rounds}
                backTees={!!state.backTees}
                putter={state.putters.find((p) => p.active)}
                courses={courses}
                baseline={state.baseline}
                shoot={avgScore}
                withTour={avgIfNeutral}
                scoredRounds={withScore.length}
              />
            </>
          )}

          <h2>Averages</h2>
          <div className="card">
            {/* Each row says what it stands on. A per-round average over three rounds and one
                over thirty are not the same claim and used to look identical. */}
            <div className="stat-row">
              <span className="k">
                Putts per round <SampleTag s={sample(o.rounds, 5, 'rounds')} />
              </span>
              <span className="v num">{o.puttsPerRound?.toFixed(1)}</span>
            </div>
            <div className="stat-row">
              <span className="k">3-putts per round</span>
              <span className={(o.threePuttsPerRound ?? 0) > 0 ? 'v num neg' : 'v num'}>
                {o.threePuttsPerRound?.toFixed(1)}
              </span>
            </div>
            <div className="stat-row">
              <span className="k">
                Make % from 3 to 10 ft{' '}
                <SampleTag s={sample(o.pooled.scoring.attempts, 50, 'putts')} />
              </span>
              <span className="v num">{pctText(o.scoringPct)}</span>
            </div>
            <div className="stat-row">
              <span className="k">
                Strokes gained per round <SampleTag s={sample(o.rounds, 5, 'rounds')} />
              </span>
              <span className={(o.sgPerRound ?? 0) >= 0 ? 'v num pos' : 'v num neg'}>
                {signedFor(o.sgPerRound ?? 0, sample(o.rounds, 5, 'rounds'))}
              </span>
            </div>
            {o.girPerRound !== null && (
              <div className="stat-row">
                <span className="k">Greens in regulation per round</span>
                <span className="v num">{o.girPerRound.toFixed(1)}</span>
              </div>
            )}
            {vol && (
              <div className="stat-row">
                <span className="k">Round-to-round swing</span>
                <span className={vol.sd > 2.5 ? 'v num neg' : 'v num'}>±{vol.sd.toFixed(1)}</span>
              </div>
            )}
          </div>

          {vol && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Swing is how far a normal round lands from your average. Your average is{' '}
              {signed(vol.mean)} strokes gained, so most rounds fall between {signed(vol.mean - vol.sd)} and{' '}
              {signed(vol.mean + vol.sd)}. Your best was {signed(vol.best)} and your worst {signed(vol.worst)}.
              A swing that wide is why one round tells you almost nothing.
            </p>
          )}

          {anyShort && (
            <p className="small muted" style={{ marginTop: -4 }}>
              A round shorter than eighteen is scaled up to compare with one.
            </p>
          )}

          <h2>Am I improving</h2>
          {[
            { title: 'Putts per round', values: o.points.map((p) => p.stats.totalPutts * p.scale), invert: true, fmt: (v: number) => v.toFixed(0) },
            { title: '3-putts per round', values: o.points.map((p) => p.stats.threePlus * p.scale), invert: true, fmt: (v: number) => v.toFixed(0) },
            { title: 'Strokes gained per round', values: o.points.map((p) => p.stats.sg * p.scale), invert: false, fmt: (v: number) => signed(v) },
            {
              title: 'Make % from 3 to 10 ft',
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
          {anyShort && (
            <p className="small muted" style={{ marginTop: 10 }}>
              A short round is scaled up here, so it sits next to an eighteen fairly. Open the
              round itself to see what it actually was.
            </p>
          )}


          {form && (
            <>
              <h2>Form</h2>
              <div className="stat-row">
                <span className="k">
                  Does Form say anything strokes gained does not
                </span>
                <span className="v small muted">
                  {trial.verdict === 'waiting'
                    ? `${trial.judged} of ${trial.needed} rounds judged`
                    : `r = ${trial.r?.toFixed(3)}`}
                </span>
              </div>
              <p className="why-note">
                {trial.verdict === 'waiting' ? (
                  <>
                    Form only earns its place if it ranks rounds differently from strokes gained.
                    The test needs <b>{trial.needed} rounds</b> with enough tagged putts to unlock
                    the process layer, and <b>{trial.judged}</b> have it. Until then this is an
                    open question, not a passed one.
                  </>
                ) : trial.verdict === 'retire' ? (
                  <>
                    <b>Form is a second name for strokes gained.</b> r = {trial.r?.toFixed(3)}{' '}
                    across {trial.judged} judged rounds, and {trial.moved} change position. The
                    threshold was written down before the answer was known, and this clears it.
                    It should go the way expected makes went.
                  </>
                ) : trial.verdict === 'keep' ? (
                  <>
                    <b>Form earns its place.</b> r = {trial.r?.toFixed(3)} across {trial.judged}{' '}
                    judged rounds, with {trial.moved} changing position. It is measuring something
                    strokes gained is not.
                  </>
                ) : (
                  <>
                    <b>Undecided.</b> r = {trial.r?.toFixed(3)} across {trial.judged} judged
                    rounds. Between the two thresholds, so the 50/50 blend gets one attempt at
                    reweighting before anyone reaches for delete.
                  </>
                )}
              </p>
              <div className="card">
                <div className="form-hero">
                  <span className="form-big" style={{ color: formBand(form.avg).ink }}>
                    {form.avg.toFixed(1)}
                  </span>
                  <span className="small muted">average over {form.rounds} rounds</span>
                </div>
                <div className="stat-row">
                  <span className="k">Best / worst round</span>
                  <span className="v num">
                    {form.best.toFixed(1)} / {form.worst.toFixed(1)}
                  </span>
                </div>
                {/* The two halves do not share a denominator: how you hit them can only average
                    the rounds that were tagged. Saying so on the row is the difference between a
                    comparison and a trap. */}
                <div className="stat-row">
                  <span className="k">
                    How you hit them
                    <span className="small muted">
                      {' '}
                      · reads, strikes, line, pace · {form.measured} round
                      {form.measured === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="v num">
                    {form.process === null ? '--' : form.process.toFixed(1)}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="k">
                    How they finished
                    <span className="small muted">
                      {' '}
                      · strokes gained, on this scale · {form.rounds} rounds
                    </span>
                  </span>
                  <span className="v num">{form.outcome.toFixed(1)}</span>
                </div>
              </div>
              <p className="small muted" style={{ margin: '8px 0 0' }}>
                Those two are averaged over different rounds, so do not read them against each
                other: only {form.measured} of {form.rounds} rounds carried enough tagged putts to
                score how you hit them, while how they finished covers all {form.rounds}. The
                untagged ones score on the finish alone, which is what the faint rail on the
                rounds list means. Open any round to see what built its number.
              </p>
            </>
          )}

          {(spread.n > 0 || verdicts.judged > 0) && (
            <>
              <h2>How often you beat the number</h2>
              {spread.n > 0 && (
                <>
                  <Why lead="One bar per hole, against what its first putt was worth.">
                    Left of zero cost you, right of zero you took it. This charted expected putts once
                    and that sorted holes in almost the order their length does, so it drew what the
                    course handed you rather than what you did with it.
                  </Why>
                  <BeatBar spread={spread} />
                </>
              )}
              {verdicts.judged > 0 && (
                <>
                  <div className="field-label">What it earned you</div>
                  <div className="board">
                    {verdicts.rows.map((row) => (
                      <div className="lb-row" key={row.verdict}>
                        <span className={`verdict v-${row.verdict}`}>{VERDICT_LABEL[row.verdict]}</span>
                        <span className="nm">
                          <span className="small muted">{row.says}</span>
                          <span className="putt-xp">from {row.avgFt.toFixed(1)} ft on average</span>
                        </span>
                        <span className="val num">{row.n}</span>
                      </div>
                    ))}
                  </div>
                  <Why lead="Against what the putt was worth, not against its length.">
                    Robbed and Sold are both misses you should have made, split on whether the stroke
                    was clean.
                  </Why>
                </>
              )}
            </>
          )}

          <h2>By distance</h2>
          <DistanceTable stats={o.pooled} rounds={o.rounds} sgPerRound={o.bucketSgPerRound} />
          <p className="small muted" style={{ marginTop: 6 }}>
            Made and % count every putt as it happened. Each row is rounded to two decimals, so
            adding them by eye can land a hundredth off the total{anyShort ? '. Short rounds are scaled up here the same way as in Averages' : ''}.
          </p>

          {/* The denominator for everything above it. A make rate reads as a problem until you
              know how far away the putts were. */}
          {o.pooled.girProximity !== null && o.pooled.gir >= 10 && (
            <p className="small muted" style={{ marginTop: 10 }}>
              <strong>On greens you hit:</strong> your first putt averages{' '}
              {o.pooled.girProximity.toFixed(1)} ft
              {o.pooled.girProximityMedian !== null
                ? `, median ${o.pooled.girProximityMedian.toFixed(1)} ft`
                : ''}
              , and {Math.round((o.pooled.girInside10 / o.pooled.gir) * 100)}% finish inside 10
              feet, over {o.pooled.gir} greens. Hitting from further out and hitting it worse both
              move this the same way, so read it as why your putts are the length they are, not as
              a verdict on your irons.
            </p>
          )}


          <p className="act">Why you miss</p>
          {strike.length > 0 && (
            <>
          <h2>Where on the face</h2>
              <StrikePanel rows={strike} />
            </>
          )}

          <h2>Misses</h2>
          <MissAnatomyPanel miss={miss} />

          <div className="field-label">Your most common miss</div>
          <MissShapesPanel shapes={shapes} />

          <div className="field-label">Where they finish</div>
          <PatternPanel stats={o.pooled} taggedRounds={taggedRounds} />

          {(read.judged > 0 || bias.n >= 10 || cup.n + cup.unsure > 0) && <h2>Reads</h2>}
          {read.judged > 0 && <ReadPanel read={read} />}

          {bias.n >= 10 && (
            <>
              <div className="field-label">Too much break or not enough</div>
              <Why lead="One axis for every putt that turns.">
                A miss finishing high and a make entering on the high side say the same thing:
                more break than it took. Until the cup existed only the misses could speak, which
                is the tail of the pattern rather than the pattern.
              </Why>
              <div className="biasbar">
                <span
                  className="bias-seg over"
                  style={{ width: `${(bias.over / bias.n) * 100}%` }}
                />
                <span
                  className="bias-seg agreed"
                  style={{ width: `${(bias.agreed / bias.n) * 100}%` }}
                />
                <span
                  className="bias-seg under"
                  style={{ width: `${(bias.under / bias.n) * 100}%` }}
                />
              </div>
              <div className="stat-row">
                <span className="k">Too much break</span>
                <span className="v num">
                  {Math.round((bias.over / bias.n) * 100)}%
                  <span className="small muted"> · {bias.over}</span>
                </span>
              </div>
              <div className="stat-row">
                <span className="k">Line and break agreed</span>
                <span className="v num">
                  {Math.round((bias.agreed / bias.n) * 100)}%
                  <span className="small muted"> · {bias.agreed}</span>
                </span>
              </div>
              <div className="stat-row">
                <span className="k">Not enough break</span>
                <span className="v num">
                  {Math.round((bias.under / bias.n) * 100)}%
                  <span className="small muted"> · {bias.under}</span>
                </span>
              </div>
              <p className="note">
                {bias.fromMisses} from misses, {bias.fromMakes} from cup entries.

              </p>
            </>
          )}

          {cup.n + cup.unsure > 0 && (
            <>
              <div className="field-label">How much of the hole you use</div>
              <CupMap
                counts={Object.fromEntries(cup.byPoint.map((b) => [b.point, b.n]))}
                unsure={cup.unsure}
                chartOnly
              />
              <div className="stat-row">
                <span className="k">Centre cut</span>
                <span className="v num">
                  {cup.n ? Math.round((cup.centre / cup.n) * 100) : 0}%
                  <span className="small muted"> · {cup.centre} of {cup.n}</span>
                </span>
              </div>
              <div className="stat-row">
                <span className="k">In off an edge</span>
                <span className="v num">{cup.edge}</span>
              </div>
              {cup.unsure > 0 && (
                <div className="stat-row">
                  <span className="k">Did not see it drop</span>
                  <span className="v num muted">{cup.unsure}</span>
                </div>
              )}
              <div className="board" style={{ marginTop: 8 }}>
                {cup.byPoint
                  .filter((b) => b.n > 0)
                  .map((b) => (
                    <div className="lb-row" key={b.point}>
                      <span className="nm">{b.label}</span>
                      <span className="val num">{b.n}</span>
                    </div>
                  ))}
              </div>
              {room.n > 0 && (
                <>
                  <div className="stat-row">
                    <span className="k">Room to spare, typical</span>
                    <span className="v num">
                      {room.mean?.toFixed(2)} in
                      <span className="small muted"> of {ROOM_MAX.toFixed(2)}</span>
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="k">Dropped with almost none</span>
                    <span className="v num">{room.nearlyMissed}</span>
                  </div>
                  {room.onPace > 0 && (
                    <div className="stat-row">
                      <span className="k">In off the back, on pace</span>
                      <span className="v num muted">{room.onPace}</span>
                    </div>
                  )}
                  <Why lead="Pure geometry, so there is no sample to wait for.">
                    A ball dead through the front had {ROOM_MAX.toFixed(2)} inches of error either
                    way; one off the lip had none. Nothing is fitted, nothing can confound it, and
                    it is as true on the first putt as the thousandth. It says nothing about pace
                    or whether the read was right: entry point is a joint result of line, speed
                    and break, so a back door can come from too much pace or from a putt that took
                    the break late.
                  </Why>
                </>
              )}

            </>
          )}

          {makeModel.ready && (
            <>
              <h2>What the break costs you</h2>
              <LearnedPanel model={makeModel} />
            </>
          )}

          <p className="act">What it costs you</p>
          <h2>Lag control</h2>
          <LagPanel stats={o.pooled} lag={lag} />
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Typical leave is every lag you hit. The comeback is only the ones that finished{' '}
            {DANGER_FROM}+ feet away, which is why it is the bigger number.
          </p>

          {lag.bySource.some((b) => b.threePutts > 0) && (
            <>
              <div className="field-label">Where your three-putts start</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>First putt</th>
                      <th>Holes</th>
                      <th>3-putts</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lag.bySource.map((b) => {
                      const rate = Math.round((b.threePutts / b.holes) * 100);
                      return (
                        <tr key={b.label}>
                          <td>{b.label}</td>
                          <td className="num">{b.holes}</td>
                          <td className={b.threePutts ? 'num neg' : 'num'}>{b.threePutts}</td>
                          <td className={rate >= 25 ? 'num neg' : 'num'}>{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

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
                  A mistake is a three-putt, or a putt missed from three to six feet, whatever the
                  hole ended up scoring. The bleeding runs until you bounce back, meaning the
                  first hole after it you play at par or better.
                </p>

                {bleed.afterRate !== null && bleed.normalRate !== null && (
                  <>
                    <div className="field-label">Bounce back</div>
                    <Bar
                      label="Hole after a mistake"
                      value={`${(bleed.afterRate * 100).toFixed(0)}%`}
                      ratio={bleed.afterRate}
                      warn={bleed.afterRate < bleed.normalRate}
                      wide
                    />
                    <Bar
                      label="Every other hole"
                      value={`${(bleed.normalRate * 100).toFixed(0)}%`}
                      ratio={bleed.normalRate}
                      wide
                    />
                    <p className="small muted" style={{ margin: '6px 0 0' }}>
                      {bleed.afterRate < bleed.normalRate
                        ? `You bounce back ${Math.round(bleed.afterRate * 100)} times in 100 after a mistake, against ${Math.round(bleed.normalRate * 100)} the rest of the time. Bleed is what the mistakes cost you. Bounce back is how fast you stop them.`
                        : 'You bounce back as often after a mistake as on any other hole, so a mistake does not follow you.'}
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


          <p className="act">When it changes</p>
          {speeds.length > 1 && (
            <>
              <h2>By green speed</h2>
              <SpeedPanel splits={speeds} />
              <p className="small muted" style={{ margin: '8px 0 0' }}>
                Per eighteen holes. If the miss line swings between bands, the greens moved your
                miss and not your read.
              </p>
            </>
          )}

          <h2>By putter</h2>
          {anyShort && (
            <p className="small muted" style={{ margin: '0 0 6px' }}>
              Per eighteen holes, so a nine-hole round counts double.
            </p>
          )}
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Putter</th>
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
                      <span className="small muted" style={{ display: 'block' }}>
                        {sub.rounds} {sub.rounds === 1 ? 'round' : 'rounds'}
                        {p.active ? ' · in the bag' : ''}
                      </span>
                    </td>
                    <td>{sub.puttsPerRound?.toFixed(1)}</td>
                    <td>{sub.threePuttsPerRound?.toFixed(1)}</td>
                    <td>{pctText(sub.scoringPct)}</td>
                    <td className={(sub.sgPerRound ?? 0) >= 0 ? 'pos' : 'neg'}>
                      {signedFor(sub.sgPerRound ?? 0, sample(sub.rounds, 5, 'rounds'))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <p className="act">What now</p>
          <h2>What to work on</h2>
          <InsightList
            stats={o.pooled}
            rounds={o.rounds}
            threePuttsPerRound={o.threePuttsPerRound}
            taggedRounds={taggedRounds}
          />
        </>

      )}
    </div>
  );
}
