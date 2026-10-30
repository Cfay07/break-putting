import { fmtDate, today as todayIso } from '../lib/format';
import { COND_LABEL, ZONE_RANGE } from '../lib/pinpoint';
import { pressureOf, spotVsMixed, SPOT_NEED, missBands, testTrend, TREND_TESTS, type SpotTally } from '../lib/practiceReview';
import { confidenceOf } from '../lib/sample';
import { resolveDrill } from '../lib/drills';
import { usePlan } from '../lib/usePlan';
import { isLagZone, SURFACE_LABELS, type MissDir, type Surface } from '../lib/types';
import { testStatus } from '../lib/weeklyTest';
import { DIR_MEANS } from '../pages/PracticeWhy';

const SURFACES: Surface[] = ['indoor', 'green'];
const pct = (made: number, of: number) => Math.round((made / of) * 100);

/** The round target, with how its fix is going in practice beside how the putt goes on the course. */
export function TargetCarry() {
  const { state, worst, whyOf, family } = usePlan();
  if (!worst || worst.sgPerRound >= 0 || confidenceOf(worst.sample) === 'waiting') return null;
  const w = whyOf(worst)[0];
  const lag = isLagZone(worst.zone);
  if (lag && !w) return null;

  const tally = (pick: (st: { d: number; mode: string }) => boolean, drill?: string) =>
    state.practice
      .filter((s) => !drill || family(s.drill) === drill)
      .flatMap((s) => s.stations ?? [])
      .filter(pick)
      .reduce((t, st) => ({ made: t.made + st.made, attempts: t.attempts + st.attempts }), { made: 0, attempts: 0 });

  const [lo, hi] = ZONE_RANGE[worst.zone];
  const title = w ? `${COND_LABEL[w.slice.cond]}, ${lag ? '16 ft and out' : worst.label}` : worst.label;
  const course = w ? { made: w.slice.made, attempts: w.slice.attempts } : { made: worst.makes, attempts: worst.attempts };
  const practice = w ? tally(() => true, w.fix.id) : tally((st) => st.mode === 'make' && st.d >= lo && st.d <= hi);
  const practiceLabel = w ? `In practice, ${w.fix.name}` : 'In practice, same distances';
  const ahead = practice.attempts > 0 && practice.made / practice.attempts > course.made / course.attempts;

  return (
    <>
      <h2>Your target, from your rounds</h2>
      <div className="card">
        <strong>{title}</strong>
        <div className="carry">
          <div>
            <strong className="num">
              {course.made} of {course.attempts}
            </strong>
            <span>On the course{lag ? ', finished within 3 ft' : ''}</span>
          </div>
          <div>
            <strong className="num">{practice.attempts ? `${practice.made} of ${practice.attempts}` : 'Not yet'}</strong>
            <span>{practiceLabel}</span>
          </div>
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          {!practice.attempts
            ? 'Roll its drill and the course starts counting from that day.'
            : ahead
              ? 'Practice is ahead of the course here. Only rounds can say whether it carries over.'
              : 'Practice is no better than the course here yet.'}
          {w?.track ? ` ${w.track}` : ''}{' '}
          <a className="inline-link" href="#/practice/why">
            See why ›
          </a>
        </p>
      </div>
    </>
  );
}

/** One bar a week, the first test of each week, on the same eighteen putts. */
export function TestTrendCard() {
  const { state, room } = usePlan();
  const date = todayIso();
  const blocks = SURFACES.map((s) => ({ s, t: testStatus(state.practice, s, room, date) })).filter((x) => x.t.weeks.length);
  if (!blocks.length) return null;
  return (
    <>
      <h2>Your test</h2>
      {blocks.map(({ s, t }) => {
        const latest = t.weeks[t.weeks.length - 1];
        const trend = testTrend(t.weeks);
        const change = t.weeks.length > 1 ? latest.made - t.weeks[0].made : 0;
        return (
          <div key={s} className="card">
            <div className="test-head">
              <strong className="num test-big">{latest.made}</strong>
              <span className="small muted">
                of {latest.attempts}, {fmtDate(latest.date)}
                {blocks.length > 1 ? ` · ${SURFACE_LABELS[s].toLowerCase()}` : ''}
              </span>
            </div>
            <div className="test-bars" aria-label={t.weeks.map((x) => `${fmtDate(x.date)} ${x.made}`).join(', ')}>
              {t.weeks.map((x) => (
                <i key={x.id} style={{ height: `${(x.made / x.attempts) * 100}%` }} className={x === t.best ? 'best' : undefined} />
              ))}
            </div>
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              {trend
                ? `${trend.last >= trend.first ? 'Up' : 'Down'} ${Math.abs(trend.last - trend.first).toFixed(1)} balls a test from your first three to your last three. ${
                    trend.beyond ? 'Bigger than a good or bad week explains.' : 'Within what a good or bad week can do.'
                  }`
                : t.weeks.length === 1
                  ? `Your first test. Best stays ${latest.made} until a week beats it.`
                  : `${change >= 0 ? 'Up' : 'Down'} ${Math.abs(change)} from your first. It takes ${TREND_TESTS} tests to tell a change from a good or bad week; you have ${t.weeks.length}.`}
            </p>
          </div>
        );
      })}
    </>
  );
}

function SpotRow({ k, t }: { k: string; t: SpotTally }) {
  return (
    <div className="stat-row">
      <span className="k">{k}</span>
      <span className="v num">
        {pct(t.made, t.attempts)}% of {t.attempts}
        <span className="small muted"> · scratch {pct(t.scratch, t.attempts)}%</span>
      </span>
    </div>
  );
}

/** The same putt over and over flatters you. The mixed number is the one the course sees. */
export function SpotVsMixed() {
  const { state } = usePlan();
  const blocks = SURFACES.map((s) => ({ s, ...spotVsMixed(state.practice, state.practiceRounds ?? [], s, state.baseline) })).filter(
    (b) => b.same.attempts >= SPOT_NEED && b.mixed.attempts >= SPOT_NEED,
  );
  if (!blocks.length) return null;
  return (
    <>
      <h2>Same spot against mixed</h2>
      {blocks.map((b) => (
        <div key={b.s}>
          {blocks.length > 1 && <p className="small muted">{SURFACE_LABELS[b.s]}</p>}
          <SpotRow k="Same putt, again and again" t={b.same} />
          <SpotRow k="A new putt every ball" t={b.mixed} />
        </div>
      ))}
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Putts from 3 to 10 ft. Scratch is what a scratch golfer holes from the same putts, so a mix of distances is a
        fair fight. Mixed means the weekly test and practice rounds, and it is the one the course sees.
      </p>
    </>
  );
}

const DIR_ORDER: MissDir[] = ['left', 'right', 'short', 'long'];
const DIR_LABEL: Record<MissDir, string> = { left: 'Left', right: 'Right', short: 'Short', long: 'Long' };

/** Every tagged practice miss, by distance, so you can see the habit instead of being told it. */
export function MissBandsCard() {
  const { state } = usePlan();
  const blocks = SURFACES.flatMap((s) => missBands(state.practice, s).map((b) => ({ s, b })));
  if (!blocks.length) return null;
  return (
    <>
      <h2>How you miss in practice</h2>
      {blocks.map(({ s, b }) => {
        const top = DIR_ORDER.reduce((a, d) => (b.dirs[d] > b.dirs[a] ? d : a), DIR_ORDER[0]);
        return (
          <div key={s + b.label} className="card miss-card">
            <strong>
              {b.label}, {SURFACE_LABELS[s].toLowerCase()}
            </strong>
            {DIR_ORDER.map((d) => (
              <div key={d} className="miss-bar">
                <span>{DIR_LABEL[d]}</span>
                <span className="miss-track">
                  <i style={{ width: `${(b.dirs[d] / b.total) * 100}%` }} className={d === top ? 'top' : undefined} />
                </span>
                <span className="num">{b.dirs[d]}</span>
              </div>
            ))}
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              From the {b.total} misses you tagged.
              {b.dirs[top] * 2 > b.total ? ` More than half went ${top}. ${DIR_MEANS[top]}` : ''}
            </p>
          </div>
        );
      })}
    </>
  );
}

/** In-a-row drills: the practice where a miss costs you something. */
export function PressureCard() {
  const { state } = usePlan();
  const p = pressureOf(state.practice, (id) => resolveDrill(state, id));
  if (p.streaks < 3 || !p.best) return null;
  return (
    <>
      <h2>When a miss costs the run</h2>
      {p.tried > 0 && (
        <div className="stat-row">
          <span className="k">In-a-row drills finished</span>
          <span className="v num">
            {p.finished} of {p.tried}
          </span>
        </div>
      )}
      <div className="stat-row">
        <span className="k">
          Longest run{p.best.d ? `, ${p.best.d} ft` : ''}
          <span className="small muted"> · {p.best.drill}</span>
        </span>
        <span className="v num">{p.best.run}</span>
      </div>
    </>
  );
}
