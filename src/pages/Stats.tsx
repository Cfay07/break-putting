import { useMemo, useState } from 'react';
import { fmtIndex, indexHistory, MIN_SCORES, TREND_FROM } from '../lib/handicap';
import { courseLabel } from '../lib/stats';
import { backTeeFor } from '../lib/courses';
import type { Round } from '../lib/types';
import { useCourseRatings } from '../lib/useCourseRatings';
import { afterMistake, bleedSummary, MAKEABLE, type AfterMistake, type BleedSummary } from '../lib/bleed';
import { fitMakeModel } from '../lib/makeability';
import { formTrial } from '../lib/formTrial';
import { formOf, formBand } from '../lib/form';
import { readBias, beatSpread } from '../lib/xp';
import { byStretch, byTrueness, conversion, tournamentVsCasual } from '../lib/situations';
import { CompareRows, CompareTable } from '../components/CompareTable';
import { DistanceTable } from '../components/DistanceTable';
import { InsightList } from '../components/InsightList';
import { LagMap } from '../components/LagMap';
import { LagPanel } from '../components/LagPanel';
import { MissAnatomyPanel } from '../components/MissAnatomyPanel';
import { MissShapesPanel } from '../components/MissShapesPanel';
import { ReadPanel } from '../components/ReadPanel';
import { readError } from '../lib/readError';
import { StrikePanel } from '../components/StrikePanel';
import { SampleTag } from '../components/SampleTag';
import { ShootSplitCard } from '../components/ShootSplitCard';
import { TopicRows, type TopicRow } from '../components/TopicRows';
import { TallyTable, tonePair } from '../components/TallyTable';
import { LevelCard } from '../components/LevelCard';
import { LagStory } from '../components/LagStory';
import { TargetLine } from '../components/TargetLine';
import { lagTrend, lagTrendStory } from '../lib/lagStory';
import { levelOf } from '../lib/level';
import {
  birdieStory,
  birdieSub,
  birdieVsPar,
  compareRates,
  greensFor,
  greensStory,
  MIN_COMMITTED_ROUNDS,
  MIN_MISTAKES,
  pressureFor,
  pressureStory,
  PUTTER_BANDS,
  putterPair,
  putterStory,
  speedExtremes,
  timingStory,
  type Tally,
} from '../lib/topicFindings';
import { GREEN_SPEED_LABELS } from '../lib/types';
import { findingsFor, locksFor, TOPIC_ABOUT, type Lock } from '../lib/statsLocks';
import { insights } from '../lib/insights';
import { go } from '../lib/router';
import { recentSplit, rowNumber, shootSplit, withinRange, type RowNumber } from '../lib/statsHome';
import { Why } from '../components/Why';
import { BeatBar } from '../components/BeatBar';
import { sample, signedFor } from '../lib/sample';
import { byStrike } from '../lib/stats';
import { LearnedPanel } from '../components/LearnedPanel';
import { PatternPanel } from '../components/PatternPanel';
import { SpeedPanel } from '../components/SpeedPanel';
import { StatsFilter } from '../components/StatsFilter';
import { PracticeStats, type PracticeTopic } from './PracticeStats';
import { applyFilter, filterLabel, isFiltered, NO_FILTER, type RoundFilter } from '../lib/roundFilter';
import { Trend } from '../components/Trend';
import { ShootCard } from '../components/ShootCard';
import { fmtDate, pctText, signed } from '../lib/format';
import {
  byGreenSpeed,
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

/** One plain line on whether mistakes spiral: only a gap of five points or more counts as one. */
function spiralLine(b: BleedSummary, a: AfterMistake): string {
  const over = (b.afterOver ?? 0) - (b.normalOver ?? 0);
  const run = (b.afterRun ?? 0) - (b.normalRun ?? 0);
  const chain = (a.chainAfter ?? 0) - (a.chainNormal ?? 0);
  const short = a.nextShort.tried ? (a.nextShort.usual - a.nextShort.made) / a.nextShort.tried : 0;
  const greens = chain >= 0.05 || short >= 0.05;
  const score =
    run >= 0.05
      ? 'Mistakes are starting runs of over-par holes'
      : over >= 0.05
        ? 'The next hole goes over par a bit more often, but not in runs'
        : 'On the scorecard, the holes after a mistake go like the rest';
  return `${score}${greens ? '. On the greens it does follow you: the next putts go worse than usual.' : ', and so do the next putts.'}`;
}
/** Each row on the Stats home opens one of these, holding that subject's part of the full page. */
export const TOPICS = {
  distance: 'By distance',
  lag: 'Lag',
  bleed: 'Bleed',
  reads: 'Reads',
  misses: 'Misses',
  strike: 'Strike',
  greens: 'Greens',
  pressure: 'Tournament vs casual',
  timing: 'When in the round',
  putter: 'By putter',
  birdie: 'Birdie vs par',
  improving: 'Am I improving',
  form: 'Form',
  work: 'What to work on',
} as const;
export type Topic = keyof typeof TOPICS;

/** The filter outlives the page, so opening a topic and coming back keeps what you picked. */
let keptFilter: RoundFilter = NO_FILTER;

export function Stats({
  practice = false,
  topic,
  practiceTopic,
}: {
  practice?: boolean;
  topic?: Topic;
  practiceTopic?: PracticeTopic;
}) {
  if (practice) {
    return (
      <div>
        {!practiceTopic && <StatsSwitch practice />}
        <PracticeStats topic={practiceTopic} />
      </div>
    );
  }
  return <RoundStats topic={topic} />;
}

function RoundStats({ topic }: { topic?: Topic }) {
  const { state, dispatch } = useApp();
  const courses = useCourseRatings();
  // Scored rounds that never said which tee, and the tee each would count off.
  const teeless = useMemo(
    () =>
      state.rounds
        .filter((r) => r.finished && !r.practice && !r.tee && r.holes.some((h) => (h.strokes ?? 0) > 0))
        .map((r) => ({ r, pick: backTeeFor(r, courses) }))
        .filter((x): x is { r: Round; pick: NonNullable<ReturnType<typeof backTeeFor>> } => !!x.pick),
    [state.rounds, courses],
  );
  const [filter, setFilterState] = useState<RoundFilter>(keptFilter);
  const setFilter = (f: RoundFilter) => {
    keptFilter = f;
    setFilterState(f);
  };
  const [filterOpen, setFilterOpen] = useState(false);

  const rounds = useMemo(
    () => applyFilter(state.rounds, filter).sort((a, b) => a.date.localeCompare(b.date)),
    [state.rounds, filter],
  );

  // The handicap follows the filter, so a putter or a stretch of dates shows what you scored to with
  // it.
  const filtered = isFiltered(filter);
  const handicap = useMemo(() => {
    const all = indexHistory(filtered ? rounds : state.rounds, courses);
    // Start at the eighth score whenever there are enough; a small filter starts at three.
    const from = all.filter((h) => h.scores >= TREND_FROM).length >= 2 ? TREND_FROM : MIN_SCORES;
    return all.filter((h) => h.scores >= from);
  }, [filtered, rounds, state.rounds, courses]);
  const o = useMemo(() => overall(rounds, state.baseline), [rounds, state.baseline]);
  const conv = useMemo(() => conversion(rounds.filter((r) => r.finished && !r.practice)), [rounds]);
  const pressure = useMemo(() => tournamentVsCasual(rounds, state.baseline), [rounds, state.baseline]);
  // Pressure compared within one putter at a time, so a putter switch cannot pass for nerves.
  const pressureByPutter = useMemo(
    () =>
      state.putters
        .map((p) => ({
          p,
          lines: tournamentVsCasual(
            rounds.filter((r) => r.putterId === p.id),
            state.baseline,
          ),
        }))
        .filter((x) => x.lines.length === 2 && x.lines.every((l) => l.rounds >= 3)),
    [rounds, state.putters, state.baseline],
  );
  const trueness = useMemo(
    () => byTrueness(rounds, state.baseline).filter((l) => l.rounds >= 3),
    [rounds, state.baseline],
  );
  const stretches = useMemo(() => byStretch(rounds, state.baseline), [rounds, state.baseline]);
  const taggedRounds = useMemo(
    () => rounds.filter((r) => r.holes.some((h) => h.putts.some((p) => p.missSide))).length,
    [rounds],
  );
  const makeModel = useMemo(() => fitMakeModel(rounds), [rounds]);
  const spread = useMemo(() => beatSpread(state.baseline, rounds), [state.baseline, rounds]);
  const bias = useMemo(() => readBias(rounds), [rounds]);
  const speeds = useMemo(() => byGreenSpeed(rounds, state.baseline), [rounds, state.baseline]);
  // The answer lines and splits on the "When it changes" pages, all one putter at a time.
  const greensSplit = useMemo(() => greensFor(rounds, state.putters), [rounds, state.putters]);
  const pair = useMemo(() => putterPair(rounds, state.putters), [rounds, state.putters]);
  const samePutter = useMemo(
    () => pressureFor(rounds, state.putters, (rs) => tournamentVsCasual(rs, state.baseline)),
    [rounds, state.putters, state.baseline],
  );
  const birdie = useMemo(() => birdieVsPar(rounds), [rounds]);
  const greensPutter = greensSplit
    ? greensSplit.current
      ? greensSplit.putter.name
      : `${greensSplit.putter.name}, your previous putter`
    : '';
  const level = useMemo(() => levelOf(rounds), [rounds]);
  // Two putters in one set average a before and an after. The newest one on its own says where you are now.
  const latestLevel = useMemo(() => {
    const ids = new Set(rounds.map((r) => r.putterId));
    if (ids.size < 2) return null;
    const newest = [...rounds].sort((a, b) => b.date.localeCompare(a.date))[0];
    const own = levelOf(rounds.filter((r) => r.putterId === newest.putterId));
    const putter = state.putters.find((p) => p.id === newest.putterId);
    return own && putter ? { name: putter.name, level: own } : null;
  }, [rounds, state.putters]);
  const firstPuttCount = useMemo(
    () =>
      rounds
        .filter((r) => r.finished && !r.practice)
        .reduce((n, r) => n + r.holes.filter((h) => h.putts.length && h.putts[h.putts.length - 1].made).length, 0),
    [rounds],
  );
  const locks = useMemo(() => locksFor(rounds, state.baseline), [rounds, state.baseline]);
  const findings = useMemo(
    () => findingsFor(rounds, state.putters, state.baseline),
    [rounds, state.putters, state.baseline],
  );
  const lock: Lock | undefined = topic ? locks[topic] : undefined;
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
  const after = useMemo(() => afterMistake(rounds), [rounds]);
  const withScore = useMemo(
    () =>
      rounds
        .map((r) => ({ r, s: roundStats(r, state.baseline), k: roundScale(r) }))
        .filter((x) => x.r.score !== undefined),
    [rounds, state.baseline],
  );
  const avgScore = withScore.length ? withScore.reduce((sum, x) => sum + x.r.score! * x.k, 0) / withScore.length : null;
  const avgIfNeutral = withScore.length
    ? withScore.reduce((sum, x) => sum + (x.r.score! + x.s.sg) * x.k, 0) / withScore.length
    : null;
  const anyShort = withScore.some((x) => x.k > 1) || rounds.some((r) => roundScale(r) > 1);

  const scoreSplit = useMemo(() => shootSplit(rounds, state.baseline), [rounds, state.baseline]);
  const biggest = useMemo(
    () => scoreSplit?.pieces.filter((p) => p.sg < -0.005).sort((a, b) => a.sg - b.sg)[0] ?? null,
    [scoreSplit],
  );
  const within = useMemo(
    () => (biggest ? withinRange(rounds, state.baseline, biggest) : null),
    [biggest, rounds, state.baseline],
  );
  const split = useMemo(() => recentSplit(rounds), [rounds]);
  // Range: the length you still hole half your first putts from, last ten against the rounds before.
  const range = useMemo((): RowNumber | null => {
    if (!split) {
      const all = levelOf(rounds);
      return all ? { now: all.d50, before: null, fresh: false } : null;
    }
    const now = levelOf(split.recent);
    if (!now) return null;
    return { now: now.d50, before: levelOf(split.before)?.d50 ?? null, fresh: false };
  }, [rounds, split]);
  const nums = useMemo(
    () =>
      Object.fromEntries(
        ['short', 'lag', 'bleed', 'reads', 'misses', 'strike', 'form'].map((k) => [
          k,
          rowNumber(k, rounds, split, state.baseline),
        ]),
      ),
    [rounds, split, state.baseline],
  );

  if (state.rounds.filter((r) => r.finished).length === 0) {
    return (
      <div className="empty">
        <p>
          Finish a round and this page turns on: strokes gained, your make rate at every distance, where your misses go,
          and what a three-putt costs you over the holes that follow.
        </p>
      </div>
    );
  }

  const pctF = (v: number) => `${Math.round(v * 100)}%`;
  const row = (r: TopicRow) => r;
  /** A row that has not got enough yet. Under a filter it says so, rather than how to unlock it. */
  const locked = (key: string, title: string): TopicRow | false =>
    !!locks[key] &&
    row({
      key,
      title,
      sub: filtered ? 'Not enough in this filter' : locks[key].how,
      locked: filtered ? '' : (locks[key].need ?? ''),
    });
  const where: TopicRow[] = [
    locked('distance', 'By distance') ||
      (range
        ? row({
            key: 'distance',
            title: 'By distance',
            sub: 'Range · half go in from here',
            num: range,
            fmt: (v: number) => `${v.toFixed(1)} ft`,
            better: 'up',
          })
        : nums.short &&
          row({
            key: 'distance',
            title: 'By distance',
            sub: '3 to 10 ft holed',
            num: nums.short,
            fmt: pctF,
            better: 'up',
            bar: nums.short.now,
          })),
    locked('lag', 'Lag') ||
      (nums.lag &&
        row({
          key: 'lag',
          title: 'Lag',
          sub: 'Inside 10% of the putt',
          num: nums.lag,
          fmt: pctF,
          better: 'up',
          bar: nums.lag.now,
        })),
    nums.bleed &&
      row({
        key: 'bleed',
        title: 'Bleed',
        sub: 'Strokes a round',
        num: nums.bleed,
        fmt: (v: number) => v.toFixed(1),
        better: 'down',
        bar: nums.bleed.now / 4,
      }),
  ].filter((r): r is TopicRow => !!r);
  const why: TopicRow[] = [
    locked('reads', 'Reads') ||
      (nums.reads &&
        row({
          key: 'reads',
          title: 'Reads',
          sub: 'Read it right',
          num: nums.reads,
          fmt: pctF,
          better: 'up',
          bar: nums.reads.now,
        })),
    locked('misses', 'Misses') ||
      (nums.misses &&
        row({
          key: 'misses',
          title: 'Misses',
          sub: 'Finished off line',
          num: nums.misses,
          fmt: pctF,
          better: 'down',
          bar: nums.misses.now,
        })),
    locked('strike', 'Strike') ||
      (nums.strike &&
        row({
          key: 'strike',
          title: 'Strike',
          sub: 'Middle of the face',
          num: nums.strike,
          fmt: pctF,
          better: 'up',
          bar: nums.strike.now,
        })),
  ].filter((r): r is TopicRow => !!r);
  const worstSpot = stretches.find((l) => l.label.startsWith('Worst hole'));
  const usedPutters = state.putters.filter((p) => rounds.some((r) => r.putterId === p.id));
  const when: TopicRow[] = [
    locked('greens', 'Greens') ||
      ((speeds.length > 1 || trueness.length > 1) &&
        row({ key: 'greens', title: 'Greens', sub: findings.greens?.text ?? 'Speed and how true' })),
    locked('pressure', 'Tournament vs casual') ||
      (pressure.length === 2 &&
        row({
          key: 'pressure',
          title: 'Tournament vs casual',
          sub: findings.pressure?.text ?? 'Same putter split too',
        })),
    stretches.length > 1 &&
      row({
        key: 'timing',
        title: 'When in the round',
        sub:
          findings.timing?.text ??
          (worstSpot ? worstSpot.label.replace('Worst hole: ', 'Worst: ') : 'First holes, last holes, nines'),
      }),
    usedPutters.length > 0 &&
      row({
        key: 'putter',
        title: 'By putter',
        sub: findings.putter?.text ?? usedPutters.map((p) => p.name).join(' and '),
      }),
    locked('birdie', 'Birdie vs par') || row({ key: 'birdie', title: 'Birdie vs par', sub: birdieSub(birdie) }),
  ].filter((r): r is TopicRow => !!r);
  const cards = insights(o.pooled, { rounds: o.rounds, threePuttsPerRound: o.threePuttsPerRound, taggedRounds });
  const time: TopicRow[] = [
    row({
      key: 'improving',
      title: 'Am I improving',
      sub: handicap.length >= 2 ? 'Handicap' : 'Your trends',
      num:
        handicap.length >= 2
          ? { now: handicap[handicap.length - 1].index, before: handicap[0].index, fresh: false }
          : null,
      fmt: fmtIndex,
      better: 'down',
    }),
    nums.form &&
      row({
        key: 'form',
        title: 'Form',
        sub:
          trial.verdict === 'waiting'
            ? `${trial.judged} of ${trial.needed} rounds to the test`
            : 'Your rating of each round',
        num: nums.form,
        fmt: (v: number) => v.toFixed(1),
        better: 'up',
      }),
    cards.length > 0 &&
      row({
        key: 'work',
        title: 'What to work on',
        sub: `${cards.length} ${cards.length === 1 ? 'thing' : 'things'} to practice`,
      }),
  ].filter((r): r is TopicRow => !!r);
  const home = (
    <>
      {scoreSplit && <ShootSplitCard split={scoreSplit} within={within} practice={null} />}
      <TargetLine />
      {where.length > 0 && <p className="topic-group">Where the strokes go</p>}
      {where.length > 0 && <TopicRows rows={where} />}
      {why.length > 0 && <p className="topic-group">Why you miss</p>}
      {why.length > 0 && <TopicRows rows={why} />}
      {when.length > 0 && <p className="topic-group">When it changes</p>}
      {when.length > 0 && <TopicRows rows={when} />}
      <p className="topic-group">Over time</p>
      <TopicRows rows={time} />
      <p className="small muted" style={{ margin: '10px 0 0' }}>
        {split
          ? `The number in each row is your last ${split.recent.length} rounds, and the arrow compares them with the ${split.before.length} before. Change the filter and both follow it.`
          : `Each number covers these ${rounds.length} rounds. Arrows show up once there are 15 to compare.`}
      </p>
    </>
  );

  return (
    <div id="stats-root">
      {topic ? (
        <>
          <button className="linkish tiny" onClick={() => go('/stats')}>
            ‹ Stats
          </button>
          <h1 className="page-title topic-title">{TOPICS[topic]}</h1>
        </>
      ) : (
        <StatsSwitch practice={false} />
      )}
      <button className={isFiltered(filter) ? 'filter-bar on' : 'filter-bar'} onClick={() => setFilterOpen(true)}>
        <span className="filter-bar-k">Showing</span>
        <span className="filter-bar-v">{filterLabel(filter, state.putters)}</span>
        <span className="filter-bar-n">
          {rounds.length} {rounds.length === 1 ? 'round' : 'rounds'}
        </span>
      </button>

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
          {!topic && home}
          {topic && lock && <LockedTopic topic={topic} lock={lock} filtered={filtered} />}

          {!lock && topic === 'improving' && (
            <>
              {avgScore !== null && avgIfNeutral !== null && (
                <>
                  <h2>What you would be shooting</h2>
                  <ShootCard
                    shoot={avgScore}
                    withTour={avgIfNeutral}
                    anyShort={anyShort}
                    rounds={withScore
                      .slice()
                      .reverse()
                      .map((x) => ({
                        id: x.r.id,
                        date: x.r.date,
                        shot: x.r.score! * x.k,
                        withTour: (x.r.score! + x.s.sg) * x.k,
                        short: x.k > 1,
                      }))}
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
                    Make % from 3 to 10 ft <SampleTag s={sample(o.pooled.scoring.attempts, 50, 'putts')} />
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
                    <span className="k">
                      Greens in regulation per round{' '}
                      <SampleTag
                        s={sample(
                          o.points.reduce((n, p) => n + p.stats.scoredHoles, 0),
                          90,
                          'holes',
                        )}
                      />
                    </span>
                    <span className="v num">{o.girPerRound.toFixed(1)}</span>
                  </div>
                )}
                {conv.greens > 0 && (
                  <div className="stat-row">
                    <span className="k">
                      Birdies from greens <SampleTag s={sample(conv.greens, 60, 'greens')} />
                    </span>
                    <span className="v num">{Math.round((conv.birdies / conv.greens) * 100)}%</span>
                  </div>
                )}
                {conv.missed > 0 && (
                  <div className="stat-row">
                    <span className="k">
                      Pars saved <SampleTag s={sample(conv.missed, 40, 'misses')} />
                    </span>
                    <span className="v num">{Math.round((conv.saves / conv.missed) * 100)}%</span>
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
                  Swing is how far a normal round lands from your average. Your average is {signed(vol.mean)} strokes
                  gained, so most rounds fall between {signed(vol.mean - vol.sd)} and {signed(vol.mean + vol.sd)}. Your
                  best was {signed(vol.best)} and your worst {signed(vol.worst)}. A swing that wide is why one round
                  tells you almost nothing.
                </p>
              )}

              {anyShort && (
                <p className="small muted" style={{ marginTop: -4 }}>
                  A round shorter than eighteen is scaled up to compare with one.
                </p>
              )}

              <h2>Handicap and trends</h2>
              {filtered && handicap.length < 2 && (
                <div className="card trend-card">
                  <span className="tiny">Handicap · {filterLabel(filter, state.putters)}</span>
                  <p className="small muted" style={{ margin: '6px 0 0' }}>
                    Not enough scores on rated tees in these rounds for a handicap. It needs four.
                  </p>
                </div>
              )}
              {handicap.length >= 2 && (
                <div className="card trend-card">
                  <div className="trend-head">
                    <span className="tiny">Handicap{filtered ? ` · ${filterLabel(filter, state.putters)}` : ''}</span>
                    <span className="trend-now">
                      <span className="num">{fmtIndex(handicap[handicap.length - 1].index)}</span>
                      <span className="tiny muted">from {fmtIndex(handicap[0].index)}</span>
                    </span>
                  </div>
                  <Trend
                    values={handicap.map((h) => h.index)}
                    invert
                    labels={handicap.map((h) => {
                      const ids = h.id.split('+');
                      const r = state.rounds.find((x) => x.id === ids[ids.length - 1]);
                      const score = ids
                        .map((id) => state.rounds.find((x) => x.id === id))
                        .reduce((a, x) => a + (x?.holes.reduce((n, hole) => n + (hole.strokes ?? 0), 0) ?? 0), 0);
                      return [
                        fmtDate(h.date),
                        r ? courseLabel(r) : '',
                        String(score),
                        `differential ${h.diff.toFixed(1)}`,
                        `handicap ${fmtIndex(h.index)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                    })}
                  />
                  <p className="small muted" style={{ margin: '6px 0 0' }}>
                    {filtered
                      ? 'Only the rounds in this filter, worked out the standard way from their best scores on rated tees. Your real handicap counts every round.'
                      : 'Worked out the standard way from your best scores on rated tees, from your eighth score on. Rounds without a known tee do not count. An estimate, not an official index.'}
                  </p>
                  {teeless.length > 0 && (
                    <p className="small" style={{ margin: '6px 0 0' }}>
                      {teeless.length} {teeless.length === 1 ? 'round has' : 'rounds have'} no tee, so{' '}
                      {teeless.length === 1 ? 'it does' : 'they do'} not count.{' '}
                      <button
                        className="linkish"
                        onClick={() =>
                          teeless.forEach(({ r, pick }) =>
                            dispatch({
                              t: 'applyCourse',
                              roundId: r.id,
                              course: r.course ?? pick.course.name,
                              courseId: pick.course.id,
                              tee: pick.tee.name,
                              pars: pick.tee.pars,
                            }),
                          )
                        }
                      >
                        Count them off the back tees
                      </button>
                    </p>
                  )}
                </div>
              )}
              {[
                {
                  title: 'Putts per round',
                  values: o.points.map((p) => p.stats.totalPutts * p.scale),
                  invert: true,
                  fmt: (v: number) => v.toFixed(0),
                },
                {
                  title: '3-putts per round',
                  values: o.points.map((p) => p.stats.threePlus * p.scale),
                  invert: true,
                  fmt: (v: number) => v.toFixed(0),
                },
                {
                  title: 'Strokes gained per round',
                  values: o.points.map((p) => p.stats.sg * p.scale),
                  invert: false,
                  fmt: (v: number) => signed(v),
                },
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
                  A short round is scaled up here, so it sits next to an eighteen fairly. Open the round itself to see
                  what it actually was.
                </p>
              )}
            </>
          )}

          {!lock && topic === 'form' && (
            <>
              {form && (
                <>
                  <div className="stat-row">
                    <span className="k">Tells you more than gained?</span>
                    <span className="v small muted">
                      {trial.verdict === 'waiting'
                        ? `${trial.judged} of ${trial.needed} rounds`
                        : `r = ${trial.r?.toFixed(3)}`}
                    </span>
                  </div>
                  <p className="why-note">
                    {trial.verdict === 'waiting' ? (
                      <>
                        Form only earns its place if it ranks rounds differently from strokes gained. The test needs{' '}
                        <b>{trial.needed} rounds</b> with enough tagged putts to unlock the process layer, and{' '}
                        <b>{trial.judged}</b> have it. Until then this is an open question, not a passed one.
                      </>
                    ) : trial.verdict === 'retire' ? (
                      <>
                        <b>Form is a second name for strokes gained.</b> r = {trial.r?.toFixed(3)} across {trial.judged}{' '}
                        judged rounds, and {trial.moved} change position. The threshold was written down before the
                        answer was known, and this clears it. It should go the way expected makes went.
                      </>
                    ) : trial.verdict === 'keep' ? (
                      <>
                        <b>Form earns its place.</b> r = {trial.r?.toFixed(3)} across {trial.judged} judged rounds, with{' '}
                        {trial.moved} changing position. It is measuring something strokes gained is not.
                      </>
                    ) : (
                      <>
                        <b>Undecided.</b> r = {trial.r?.toFixed(3)} across {trial.judged} judged rounds. Between the two
                        thresholds, so the 50/50 blend gets one attempt at reweighting before anyone reaches for delete.
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
                          · {form.measured} round
                          {form.measured === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="v num">{form.process === null ? '--' : form.process.toFixed(1)}</span>
                    </div>
                    <div className="stat-row">
                      <span className="k">
                        How they finished
                        <span className="small muted"> · {form.rounds} rounds</span>
                      </span>
                      <span className="v num">{form.outcome.toFixed(1)}</span>
                    </div>
                  </div>
                  <p className="small muted" style={{ margin: '8px 0 0' }}>
                    Those two are averaged over different rounds, so do not read them against each other: only{' '}
                    {form.measured} of {form.rounds} rounds carried enough tagged putts to score how you hit them, while
                    how they finished covers all {form.rounds}. The untagged ones score on the finish alone, which is
                    what the faint rail on the rounds list means. Open any round to see what built its number.
                  </p>
                </>
              )}
            </>
          )}

          {!lock && topic === 'distance' && (
            <>
              <LevelCard level={level} firstPutts={firstPuttCount} latest={latestLevel} />
              {spread.n > 0 && (
                <>
                  <h2>How often you beat the number</h2>
                  {spread.n > 0 && (
                    <>
                      <Why lead="One bar per hole, against what its first putt was worth.">
                        Left of zero cost you, right of zero you took it. This charted expected putts once and that
                        sorted holes in almost the order their length does, so it drew what the course handed you rather
                        than what you did with it.
                      </Why>
                      <BeatBar spread={spread} />
                    </>
                  )}
                </>
              )}

              <h2>By distance</h2>
              <DistanceTable stats={o.pooled} rounds={o.rounds} sgPerRound={o.bucketSgPerRound} />
              <p className="small muted" style={{ marginTop: 6 }}>
                Made and % count every putt as it happened. Each row is rounded to two decimals, so adding them by eye
                can land a hundredth off the total
                {anyShort ? '. Short rounds are scaled up here the same way as in Averages' : ''}.
              </p>

              {/* The denominator for everything above it. A make rate reads as a problem until you
              know how far away the putts were. */}
              {o.pooled.girProximity !== null && o.pooled.gir >= 10 && (
                <p className="small muted" style={{ marginTop: 10 }}>
                  <strong>On greens you hit:</strong> your first putt averages {o.pooled.girProximity.toFixed(1)} ft
                  {o.pooled.girProximityMedian !== null ? `, median ${o.pooled.girProximityMedian.toFixed(1)} ft` : ''},
                  and {Math.round((o.pooled.girInside10 / o.pooled.gir) * 100)}% finish inside 10 feet, over{' '}
                  {o.pooled.gir} greens. Hitting from further out and hitting it worse both move this the same way, so
                  read it as why your putts are the length they are, not as a verdict on your irons.
                </p>
              )}
            </>
          )}

          {!lock && topic === 'strike' && (
            <>
              {strike.length > 0 && (
                <>
                  <h2>Where on the face</h2>
                  <StrikePanel rows={strike} />
                </>
              )}
            </>
          )}

          {!lock && topic === 'misses' && (
            <>
              <MissAnatomyPanel miss={miss} />

              <div className="field-label">Your most common miss</div>
              <MissShapesPanel shapes={shapes} />

              <div className="field-label">Where they finish</div>
              <PatternPanel stats={o.pooled} taggedRounds={taggedRounds} />
            </>
          )}

          {!lock && topic === 'reads' && (
            <>
              {read.judged > 0 && <ReadPanel read={read} />}

              {bias.n >= 10 && (
                <>
                  <div className="field-label">Too much break or not enough</div>
                  <Why lead="From where your misses finished on putts that turn.">
                    A miss finishing high often means more break than it took, and low not enough, but pace can send a
                    putt either side too. The read tags above say which it was.
                  </Why>
                  <div className="biasbar">
                    <span className="bias-seg over" style={{ width: `${(bias.over / bias.n) * 100}%` }} />
                    <span className="bias-seg agreed" style={{ width: `${(bias.agreed / bias.n) * 100}%` }} />
                    <span className="bias-seg under" style={{ width: `${(bias.under / bias.n) * 100}%` }} />
                  </div>
                  <div className="stat-row">
                    <span className="k">Too much break</span>
                    <span className="v num">
                      {Math.round((bias.over / bias.n) * 100)}%<span className="small muted"> · {bias.over}</span>
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="k">Line and break agreed</span>
                    <span className="v num">
                      {Math.round((bias.agreed / bias.n) * 100)}%<span className="small muted"> · {bias.agreed}</span>
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="k">Not enough break</span>
                    <span className="v num">
                      {Math.round((bias.under / bias.n) * 100)}%<span className="small muted"> · {bias.under}</span>
                    </span>
                  </div>
                  <p className="note">From {bias.n} misses with a side tagged.</p>
                </>
              )}

              {makeModel.ready && (
                <>
                  <h2>What the break costs you</h2>
                  <LearnedPanel model={makeModel} />
                </>
              )}
            </>
          )}

          {!lock && topic === 'lag' && (
            <>
              {lagTrendStory(lagTrend(rounds)) && <p className="topic-answer">{lagTrendStory(lagTrend(rounds))}</p>}
              <LagPanel stats={o.pooled} lag={lag} />
              <p className="small muted" style={{ margin: '8px 0 0' }}>
                Inside 10% means it went in or finished within a tenth of the putt's length. The comeback is the putt
                the rest left you.
              </p>
              <LagMap rounds={rounds} limit={50} />

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
              <LagStory rounds={rounds} putters={state.putters} practice={null} />
              <TargetLine />
            </>
          )}

          {!lock && topic === 'bleed' && (
            <>
              {bleed.shotsPerRound !== null && bleed.shotsPerRound > 0 && (
                <>
                  <div className="card">
                    <div className="shoot-for num neg">{bleed.shotsPerRound.toFixed(1)}</div>
                    <p className="small" style={{ margin: '4px 0 0' }}>
                      Strokes a round your putting mistakes put on the card. A mistake is a three-putt, or a putt missed
                      from {MAKEABLE.max} feet or closer.
                    </p>
                    <div className="stat-row" style={{ marginTop: 8 }}>
                      <span className="k">Three-putts</span>
                      <span className="v num">{bleed.threePuttsPerRound!.toFixed(1)}</span>
                    </div>
                    <div className="stat-row">
                      <span className="k">Missed inside {MAKEABLE.max} ft</span>
                      <span className="v num">{bleed.shortMissesPerRound!.toFixed(1)}</span>
                    </div>
                    {bleed.avgScore !== null && bleed.withoutScore !== null && (
                      <div className="stat-row">
                        <span className="k">Your average, without them</span>
                        <span className="v num">
                          {bleed.avgScore.toFixed(1)} <span className="muted">→</span>{' '}
                          <span className="pos">{bleed.withoutScore.toFixed(1)}</span>
                        </span>
                      </div>
                    )}

                    {bleed.afterOver !== null && bleed.normalOver !== null && (
                      <>
                        <div className="field-label">Does it spiral</div>
                        <div className="stat-row">
                          <span className="k">Next hole over par</span>
                          <span className="v num">
                            {Math.round(bleed.afterOver * 100)}%
                            <span className="small muted"> · {Math.round(bleed.normalOver * 100)}% otherwise</span>
                          </span>
                        </div>
                        {bleed.afterRun !== null && bleed.normalRun !== null && (
                          <div className="stat-row">
                            <span className="k">Two over par in a row</span>
                            <span className="v num">
                              {Math.round(bleed.afterRun * 100)}%
                              <span className="small muted"> · {Math.round(bleed.normalRun * 100)}% otherwise</span>
                            </span>
                          </div>
                        )}
                        {after.nextShort.tried > 0 && (
                          <div className="stat-row">
                            <span className="k">Next 3 to 10 ft holed</span>
                            <span className="v num">
                              {after.nextShort.made} of {after.nextShort.tried}
                              <span className="small muted"> · usual {Math.round(after.nextShort.usual)}</span>
                            </span>
                          </div>
                        )}
                        {after.chainAfter !== null && after.chainNormal !== null && (
                          <div className="stat-row">
                            <span className="k">Another mistake next</span>
                            <span className="v num">
                              {Math.round(after.chainAfter * 100)}%
                              <span className="small muted"> · {Math.round(after.chainNormal * 100)}% otherwise</span>
                            </span>
                          </div>
                        )}
                        <p className="small muted" style={{ margin: '6px 0 0' }}>
                          {spiralLine(bleed, after)} Usual is what you hole from those lengths with that putter. From{' '}
                          {bleed.sample} holes played right after a mistake
                          {bleed.sample < 200 ? ', so read a small gap as a lead, not a verdict' : ''}.
                        </p>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {!lock && topic === 'greens' && (
            <>
              {greensSplit && (
                <>
                  {greensStory(greensSplit.lines, greensPutter) && (
                    <p className="topic-answer">{greensStory(greensSplit.lines, greensPutter)}</p>
                  )}
                  <div className="field-label">
                    By speed, {greensSplit.putter.name} only{greensSplit.current ? '' : ' · previous putter'}
                  </div>
                  <TallyTable
                    heads={['Rounds', '3 to 10 ft', 'Lags']}
                    rows={greensSplit.lines.map((l) => {
                      const x = speedExtremes(greensSplit.lines);
                      const clear = x?.verdict === 'clear';
                      return {
                        label: GREEN_SPEED_LABELS[l.speed],
                        cells: [String(l.rounds), l.short, l.lags],
                        tone: [undefined, clear && l === x.worst ? 'neg' : clear && l === x.best ? 'pos' : undefined],
                      };
                    })}
                  />
                  <p className="small muted" style={{ margin: '8px 0 0' }}>
                    One putter at a time, so a putter switch can't pass for green speed. Lags are first putts from 30 ft
                    or more that finish inside 10% of their length.
                  </p>
                </>
              )}
              {speeds.length > 1 && (
                <>
                  <div className="field-label">By speed, all putters</div>
                  <SpeedPanel splits={speeds} />
                  <p className="small muted" style={{ margin: '8px 0 0' }}>
                    Per eighteen holes. If the miss line swings between bands, the greens moved your miss and not your
                    read.
                  </p>
                </>
              )}
              {trueness.length > 1 && (
                <>
                  <div className="field-label">How true they rolled</div>
                  <CompareTable lines={trueness} />
                  <p className="small muted" style={{ margin: '8px 0 0' }}>
                    From the rounds you marked smooth, average or bumpy.
                  </p>
                </>
              )}
              {trueness.length < 2 && rounds.some((r) => r.bumpy) && (
                <>
                  <div className="field-label">How true they rolled</div>
                  <p className="small muted" style={{ margin: 0 }}>
                    Shows once two kinds have 3 rounds each. You've marked{' '}
                    {rounds.filter((r) => r.bumpy && r.finished && !r.practice).length}.
                  </p>
                </>
              )}
            </>
          )}

          {!lock && topic === 'pressure' && (
            <>
              {samePutter && <PressureSplit p={samePutter} />}
              {pressure.length === 2 && (
                <>
                  <div className="field-label">All putters together</div>
                  <CompareTable lines={pressure} />
                  <p className="small muted" style={{ margin: '8px 0 0' }}>
                    Mixes putters, so a putter switch shows up here as pressure.
                  </p>
                  {pressureByPutter.length > 0 && (
                    <>
                      <div className="field-label">Each putter, gained per 18</div>
                      <div className="card">
                        {pressureByPutter.map(({ p, lines }) => (
                          <div className="stat-row" key={p.id}>
                            <span className="k">{p.name}</span>
                            <span className="v num">
                              {lines[0].sg === null ? '--' : signed(lines[0].sg, 1)}
                              <span className="small muted"> vs </span>
                              {lines[1].sg === null ? '--' : signed(lines[1].sg, 1)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="small muted" style={{ margin: '8px 0 0' }}>
                        Strokes gained per 18, tournament against casual, with one putter at a time, so a putter switch
                        cannot pass for nerves.
                      </p>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {!lock && topic === 'timing' && (
            <>
              {stretches.length > 1 && (
                <>
                  {timingStory(stretches) && <p className="topic-answer">{timingStory(stretches)}</p>}
                  <CompareRows lines={stretches} />
                  <p className="small muted" style={{ margin: '8px 0 0' }}>
                    Gained is strokes gained per hole on average; 3-putts is how often a hole there took three. In the
                    order you played them, so a shotgun start still reads right. Nines split only on eighteen-hole
                    rounds.
                  </p>
                </>
              )}
            </>
          )}

          {!lock && topic === 'putter' && (
            <>
              {pair ? (
                <PutterSplit pair={pair} />
              ) : (
                usedPutters.length === 1 &&
                state.putters.length > 1 && (
                  <p className="small muted" style={{ margin: '0 0 10px' }}>
                    Filtered to one putter. Clear the putter filter to compare them.
                  </p>
                )
              )}
              <div className="field-label">Every putter</div>
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
            </>
          )}

          {!lock && topic === 'birdie' && (
            <>
              <p className="topic-answer">{birdieStory(birdie)}</p>
              {birdie.bands.length > 0 && (
                <>
                  <div className="field-label">First putt on the green</div>
                  <TallyTable
                    heads={['For birdie', 'For par']}
                    rows={birdie.bands.map((b) => ({ label: b.label, cells: [b.birdie, b.par] }))}
                  />
                  <p className="small muted" style={{ margin: '8px 0 0' }}>
                    First putts only, so a comeback that already saw the line never counts as a par putt. Each birdie
                    putt is judged against par putts with the same putter from the same lengths.
                  </p>
                </>
              )}
            </>
          )}

          {!lock && topic === 'work' && (
            <>
              <TargetLine />
              <InsightList
                stats={o.pooled}
                rounds={o.rounds}
                threePuttsPerRound={o.threePuttsPerRound}
                taggedRounds={taggedRounds}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Tournament against casual with one putter, so nerves are measured and not the switch. */
function PressureSplit({ p }: { p: NonNullable<ReturnType<typeof pressureFor>> }) {
  const { tournament: t, casual: c } = p;
  const name = p.current ? p.putter.name : `${p.putter.name} (previous putter)`;
  const shortClear = compareRates(t.short, c.short).verdict === 'clear';
  const over = (x: number | null) => (x === null ? '--' : `${Math.round(x * 100)}%`);
  return (
    <>
      <p className="topic-answer">{pressureStory(p)}</p>
      <div className="field-label">Same putter only, {name}</div>
      <TallyTable
        heads={['Tournament', 'Casual']}
        rows={[
          { label: 'Rounds', cells: [String(t.rounds), String(c.rounds)] },
          { label: '3 to 10 ft', cells: [t.short, c.short], tone: tonePair(t.short, c.short, shortClear) },
          {
            label: 'Gained per 18',
            cells: [t.sg === null ? '--' : signed(t.sg, 1), c.sg === null ? '--' : signed(c.sg, 1)],
          },
          {
            label: 'Bleed a round',
            cells: [t.bleed === null ? '--' : t.bleed.toFixed(1), c.bleed === null ? '--' : c.bleed.toFixed(1)],
          },
        ]}
      />
      <div className="field-label">Next hole over par, after a mistake</div>
      {t.mistakes >= MIN_MISTAKES && c.mistakes >= MIN_MISTAKES ? (
        <TallyTable
          heads={['Tournament', 'Casual']}
          rows={[
            { label: 'After a mistake', cells: [over(t.afterOver), over(c.afterOver)] },
            { label: 'Every other hole', cells: [over(t.normalOver), over(c.normalOver)] },
          ]}
        />
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          Shows at {MIN_MISTAKES} mistakes on each side with one putter. You have {t.mistakes} in tournaments and{' '}
          {c.mistakes} casual with the {name}.
        </p>
      )}
      <div className="field-label">Committed</div>
      {t.committedRounds >= MIN_COMMITTED_ROUNDS && c.committedRounds >= MIN_COMMITTED_ROUNDS ? (
        <TallyTable
          heads={['Tournament', 'Casual']}
          rows={[{ label: 'Committed', cells: [t.committed, c.committed] }]}
        />
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          Shows once {MIN_COMMITTED_ROUNDS} tournament and {MIN_COMMITTED_ROUNDS} casual rounds have it tagged. You have{' '}
          {t.committedRounds} and {c.committedRounds}.
        </p>
      )}
    </>
  );
}

/** The two putters used most lately over the same distances, older first. */
function PutterSplit({ pair }: { pair: NonNullable<ReturnType<typeof putterPair>> }) {
  const [a, b] = pair;
  const line = (label: string, x: Tally, y: Tally) => ({
    label,
    cells: [x, y],
    tone: tonePair(x, y, compareRates(x, y).verdict === 'clear'),
  });
  return (
    <>
      <p className="topic-answer">{putterStory(pair)}</p>
      <div className="field-label">Same distances, each putter</div>
      <TallyTable
        heads={[a.putter.name, b.putter.name]}
        rows={[
          ...PUTTER_BANDS.map((band, i) => line(band.label, a.bands[i], b.bands[i])),
          line('Lags inside 10%', a.lags, b.lags),
          line('Comebacks holed', a.comebacks, b.comebacks),
        ]}
      />
    </>
  );
}

/** A page without enough yet: what it will show, and what to log to open it. */
function LockedTopic({ topic, lock, filtered }: { topic: Topic; lock: Lock; filtered: boolean }) {
  return (
    <div className="card locked-topic">
      {TOPIC_ABOUT[topic] && <p className="topic-answer">{TOPIC_ABOUT[topic]}</p>}
      {filtered ? (
        <p className="small muted" style={{ margin: 0 }}>
          Not enough in this filter. Widen it to see this page.
        </p>
      ) : (
        <p className="small" style={{ margin: 0 }}>
          {lock.how}
          {lock.need ? <span className="muted"> · {lock.need}</span> : null}
        </p>
      )}
    </div>
  );
}
