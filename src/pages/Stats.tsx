import { useMemo, useState } from 'react';
import { bleedSummary } from '../lib/bleed';
import { fitMakeModel } from '../lib/makeability';
import { formTrial } from '../lib/formTrial';
import {
  cupUse,
  readBias,
  roomSpare,
  ROOM_MAX,
  fitExecModel,
  VERDICT_LABEL,
  verdictTally,
  xpotReason,
  beatSpread,
} from '../lib/xp';
import { DistanceTable } from '../components/DistanceTable';
import { InsightList } from '../components/InsightList';
import { LagPanel } from '../components/LagPanel';
import { MissAnatomyPanel } from '../components/MissAnatomyPanel';
import { MissShapesPanel } from '../components/MissShapesPanel';
import { ReadPanel } from '../components/ReadPanel';
import { ConditionPanel } from '../components/ConditionPanel';
import { DriftPanel } from '../components/DriftPanel';
import { StakesPanel } from '../components/StakesPanel';
import { driftOf } from '../lib/drift';
import { stakesOf } from '../lib/stakes';
import { byConditions } from '../lib/conditions';
import { readError } from '../lib/readError';
import { formOf, formBand } from '../lib/form';
import { StrikePanel } from '../components/StrikePanel';
import { SampleTag } from '../components/SampleTag';
import { SectionNav } from '../components/SectionNav';
import { CupMap } from '../components/CupMap';
import { Why } from '../components/Why';
import { BeatBar } from '../components/BeatBar';
import { sample } from '../lib/sample';
import { byStrike } from '../lib/stats';
import { LearnedPanel } from '../components/LearnedPanel';
import { PatternPanel } from '../components/PatternPanel';
import { SpeedPanel } from '../components/SpeedPanel';
import { StatsFilter } from '../components/StatsFilter';
import { PracticeStats } from './PracticeStats';
import { applyFilter, filterLabel, isFiltered, NO_FILTER, type RoundFilter } from '../lib/roundFilter';
import { Trend } from '../components/Trend';
import { fmtDate, pctText, signed } from '../lib/format';
import { Bar } from '../components/Bar';
import {
  byCourse,
  byGreenSpeed,
  DANGER_FROM,
  lagSaves,
  missAnatomy,
  missShapes,
  volatility,
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
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState(AVG);

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
  const trial = useMemo(() => formTrial(rounds, state.baseline), [rounds, state.baseline]);
  const verdicts = useMemo(
    () => verdictTally(makeModel, state.baseline, rounds),
    [makeModel, state.baseline, rounds],
  );
  const exec = useMemo(() => fitExecModel(makeModel, rounds), [makeModel, rounds]);
  const drift = useMemo(() => driftOf(rounds), [rounds]);
  const stakes = useMemo(() => stakesOf(rounds), [rounds]);
  const courses = useMemo(() => byCourse(rounds, state.baseline), [rounds, state.baseline]);
  const speeds = useMemo(() => byGreenSpeed(rounds, state.baseline), [rounds, state.baseline]);
  const lag = useMemo(() => lagSaves(rounds), [rounds]);
  const read = useMemo(() => readError(rounds), [rounds]);
  const strike = useMemo(() => byStrike(rounds), [rounds]);

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
  const conditions = useMemo(() => byConditions(rounds, state.baseline), [rounds, state.baseline]);
  const miss = useMemo(() => missAnatomy(rounds), [rounds]);
  const shapes = useMemo(() => missShapes(rounds), [rounds]);
  const vol = useMemo(() => volatility(rounds, state.baseline), [rounds, state.baseline]);
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
      k: 'Make % from 3 to 10 ft',
      get: (s) => s.scoring,
      lowerBetter: false,
      fmt: (v) => `${v.toFixed(0)}%`,
      dfmt: (v) => `${v.toFixed(0)}%`,
    },
    { k: 'Strokes gained', get: (s) => s.sg, lowerBetter: false, fmt: (v) => signed(v), dfmt: (v) => v.toFixed(1) },
    { k: 'Greens hit', get: (s) => s.gir, lowerBetter: false, fmt: (v) => v.toFixed(1), dfmt: (v) => v.toFixed(1) },
  ];

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
              <div className="card">
                {/* Both numbers, because the gap between them is the whole point and the real
                    one used to be a figure inside a sentence. */}
                <div className="shoot-pair">
                  <span className="shoot-one">
                    <span className="shoot-for num">{avgScore.toFixed(1)}</span>
                    <span className="tiny">You shoot</span>
                  </span>
                  <span className="shoot-arrow" aria-hidden="true">→</span>
                  <span className="shoot-one">
                    <span className="shoot-for num">{avgIfNeutral.toFixed(1)}</span>
                    <span className="tiny">With tour putting</span>
                  </span>
                </div>
                <p className="small" style={{ margin: '4px 0 12px' }}>
                  Your scoring average over {withScore.length} scored round
                  {withScore.length === 1 ? '' : 's'}, and the same rounds with a tour pro's
                  putting dropped in.{' '}
                  {avgIfNeutral > avgScore
                    ? `You putt better than tour, so swapping in their putter would cost you ${(
                        avgIfNeutral - avgScore
                      ).toFixed(1)} a round. The putter is already an asset; the strokes are
                        somewhere else.`
                    : `Strokes gained is always measured against tour, so read the ${(
                        avgScore - avgIfNeutral
                      ).toFixed(1)} as the gap to a pro's putter, not to a decent amateur one.`}
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
                  {anyShort ? 'A round shorter than eighteen is scaled up so it compares to one.' : ''}
                </p>
              </div>
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
                {signed(o.sgPerRound ?? 0)}
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
              Strokes gained has run from {signed(vol.best)} at your best to{' '}
              {signed(vol.worst)} at your worst, and most rounds land within {vol.sd.toFixed(1)}
              {' '}of the average. That spread is why one round tells you almost nothing.
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

          {spread.n > 0 && (
            <>
              <h2>How often you beat the number</h2>
              <Why lead="One bar per hole, against what its first putt was worth.">
                Left of zero cost you, right of zero you took it. This charted expected putts once
                and that sorted holes in almost the order their length does, so it drew what the
                course handed you rather than what you did with it.
              </Why>
              <BeatBar spread={spread} />
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
              {(exec.nClean > 0 || exec.nFaulty > 0) && (
                <>
              <h2>Does your stroke tagging predict misses</h2>
          {exec.confounded ? (
            <p className="why-note">
              <b>Cannot be measured yet, and not because of sample size.</b> Faults have only ever
              been recorded on putts that missed ({exec.faultyMakes} holed putts carry one), so
              "has a fault" is standing in for "missed" and any gap would be the outcome wearing a
              different name. The factor chips were hidden on holed putts until now, which is why.
              Only a putt struck badly and holed anyway can separate the two.
            </p>
          ) : exec.nClean < 5 || exec.nFaulty < 5 ? (
            <Why lead="Not enough strokes judged yet.">
              This needs putts where you either ticked a fault or said outright that nothing was
              wrong, because a blank cannot tell the two apart.
            </Why>
          ) : (
            <>
              <div className="stat-row">
                <span className="k">Clean strokes</span>
                <span className="v num">
                  {Math.round((exec.cleanRate ?? 0) * 100)}%
                  <span className="small muted"> · {exec.nClean} putts</span>
                </span>
              </div>
              <div className="stat-row">
                <span className="k">With a fault recorded</span>
                <span className="v num">
                  {Math.round((exec.faultyRate ?? 0) * 100)}%
                  <span className="small muted"> · {exec.nFaulty} putts</span>
                </span>
              </div>
              <div className="stat-row">
                <span className="k">The gap</span>
                <span className="v num">
                  {Math.round((exec.gap ?? 0) * 100)} pts
                  <span className="small muted"> ± {Math.round((exec.band ?? 0) * 100)}</span>
                </span>
              </div>
              <div className="stat-row">
                <span className="k">After the stroke</span>
                <span className="v small muted">{xpotReason(exec) || 'live on every putt card'}</span>
              </div>
              <p className={exec.predictive ? 'note' : 'why-note'}>
                {exec.predictive ? (
                  <>
                    <b>Yes.</b> Clean strokes drop{' '}
                    {Math.round((exec.gap ?? 0) * 100)} points more often than faulty ones, and the
                    margin is narrower than the gap. Stroke cost now shows on each putt.
                  </>
                ) : (
                  <>
                    <b>Not yet.</b> The margin ({Math.round((exec.band ?? 0) * 100)} points) is wider
                    than the gap ({Math.round((exec.gap ?? 0) * 100)}), so this cannot be told apart
                    from no effect at all. It is not evidence your stroke does not matter, only that
                    {' '}{exec.nClean + exec.nFaulty} judged putts cannot settle it. Until it clears,
                    nothing in the app prices a fault.
                  </>
                )}
              </p>
            </>
          )}
                </>
              )}

          <h2>Where on the face</h2>
              <StrikePanel rows={strike} />
            </>
          )}

          <h2>When you miss, why</h2>
          <MissAnatomyPanel miss={miss} />

          <div className="field-label">Your most common miss</div>
          <MissShapesPanel shapes={shapes} />

          {read.judged > 0 && (
            <>
              <h2>The read</h2>
              <ReadPanel read={read} />
            </>
          )}

          {bias.n >= 10 && (
            <>
              <h2>Too much break or not enough</h2>
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
              <h2>How much of the hole you use</h2>
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

          <h2>Miss patterns</h2>
          <PatternPanel stats={o.pooled} taggedRounds={taggedRounds} />

          {makeModel.ready && (
            <>
              <h2>What the break costs you</h2>
              <LearnedPanel model={makeModel} />
            </>
          )}

          {drift.rate !== null && drift.z !== null && (
            <>
              <h2>Drift</h2>
              <DriftPanel drift={drift} />
            </>
          )}

          {stakes.rows.length > 0 && (
            <>
              <h2>Stakes</h2>
              <StakesPanel stakes={stakes} />
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

          <h2>Greens, beyond speed</h2>
          <ConditionPanel splits={conditions} />

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
                          <td>{side.puttsPerHole.toFixed(1)}</td>
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
                      <div className="field-label">Scrambling putts, matched for distance</div>
                      <p className="small muted" style={{ margin: '0 0 8px' }}>
                        Only the putts after a missed green. The second bar is what your own make
                        rate from those exact distances says you should have made, so the two bars
                        are the same putts held to your own standard.
                      </p>
                      <Bar
                        label="What you made"
                        value={`${made.toFixed(1)}%`}
                        ratio={made / 100}
                        warn={gap < -floor}
                        wide
                      />
                      <Bar
                        label="What you normally make from there"
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
                        The gap has to clear {floor.toFixed(1)} points before it means anything,
                        off {m.attempts} putts. This test is weak either way:
                        the two groups barely sit at the same distances, so there is not much to
                        match on.
                      </p>
                    </>
                  );
                })()}
              </div>
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
                    <td>{sub.threePuttsPerRound?.toFixed(1)}</td>
                    <td>{pctText(sub.scoringPct)}</td>
                    <td className={(sub.sgPerRound ?? 0) >= 0 ? 'pos' : 'neg'}>
                      {signed(sub.sgPerRound ?? 0)}
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
                <table className="course-table">
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
                        <td className={c.sg >= 0 ? 'pos' : 'neg'}>{signed(c.sg)}</td>
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


          <p className="act">What now</p>
          <h2>Compare two rounds</h2>
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
          {anyShort && (
            <p className="small muted" style={{ marginTop: 6 }}>
              A short round is scaled up on both sides here, so the comparison is like for like.
            </p>
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
    </div>
  );
}
