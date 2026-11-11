import type { ReactNode } from 'react';
import { fmtDate, signed, today as todayIso } from '../lib/format';
import { resolveDrill } from '../lib/drills';
import { trendOf } from '../lib/practice';
import { putterName } from '../lib/store';
import {
  BEFORE_DAYS,
  compare,
  per18,
  practiceSplit,
  practiceWeeks,
  rate,
  statusOf,
  STATUS_WORD,
  windows,
  type Compare,
  type Verdict,
} from '../lib/progress';
import { usePractice } from '../lib/usePractice';
import type { PracticeSet } from '../lib/types';
import { TEST_ID, weekOf } from '../lib/weeklyTest';

const PILL: Record<Exclude<Verdict, 'early'>, string> = {
  better: 'Better',
  'probably-better': 'Probably better',
  holding: 'Holding',
  'probably-worse': 'Probably worse',
  worse: 'Worse',
};

function pillText(c: Compare, unit: string): string {
  if (c.verdict !== 'early') return PILL[c.verdict];
  return c.need > 0 ? `Too early · ${c.need} more ${c.need === 1 ? unit : `${unit}s`}` : 'Too early';
}

const pillClass = (v: Verdict) =>
  v === 'better' || v === 'probably-better' ? 'pay-pill up' : v === 'worse' || v === 'probably-worse' ? 'pay-pill down' : 'pay-pill';

function Bars({ values, max, band }: { values: number[]; max: number; band?: [number, number] | null }) {
  if (values.length < 2) return null;
  const h = 48;
  const y = (v: number) => h - (v / max) * h;
  const w = 300 / values.length;
  return (
    <svg viewBox={`0 0 300 ${h}`} className="pay-bars" aria-hidden="true">
      {band && <rect x="0" y={y(band[1])} width="300" height={Math.max(2, y(band[0]) - y(band[1]))} className="pay-band" />}
      {values.map((v, i) => (
        <rect key={i} x={i * w + 3} y={y(v)} width={w - 6} height={h - y(v)} rx="3" className={i === values.length - 1 ? 'pay-bar last' : 'pay-bar'} />
      ))}
    </svg>
  );
}

function Row({ title, c, unit, text, bars }: { title: string; c: Compare; unit: string; text: string; bars?: ReactNode }) {
  return (
    <div className="pay-row">
      <div className="pay-row-head">
        <strong>{title}</strong>
        <span className={pillClass(c.verdict)}>{pillText(c, unit)}</span>
      </div>
      {bars}
      <p>{text}</p>
    </div>
  );
}

/**
 * The top of Stats > Practice: is the work paying off. A practice status read from effort against
 * results, rounds after practice against the rest, the weekly test and the target's check, each
 * judged against your own normal swing over the last four weeks and the eight before.
 */
export function ProgressHeader() {
  const { state, scoped, family, putterId } = usePractice();
  const today = todayIso();
  const sets = state.practice.filter((s) => !s.game && s.attempts > 0);
  const practiceDates = [...sets.map((s) => s.date), ...(state.practiceRounds ?? []).map((r) => r.date)];
  const weeks = practiceWeeks(practiceDates, today);
  const recentWeeks = weeks.slice(-4).filter(Boolean).length;

  // The weekly test: the first of each week, on the surface you test on most.
  const tests = sets.filter((s) => s.drill === TEST_ID);
  const surface = (['indoor', 'green'] as const).reduce((a, b) => (tests.filter((t) => t.surface === b).length > tests.filter((t) => t.surface === a).length ? b : a), 'indoor' as const);
  const firstOfWeek = new Map<string, PracticeSet>();
  for (const t of tests.filter((x) => x.surface === surface).sort((a, b) => a.date.localeCompare(b.date))) {
    if (!firstOfWeek.has(weekOf(t.date))) firstOfWeek.set(weekOf(t.date), t);
  }
  const weekly = [...firstOfWeek.values()];
  const tw = windows(weekly, today);
  const test = compare(tw.recent.map((t) => t.made), tw.before.map((t) => t.made));
  const testBand: [number, number] | null = test.before !== null && test.swing ? [test.before - test.swing, test.before + test.swing] : null;

  // The target's check: the mixed set from its distances.
  const [kind, zone] = (state.target && !state.target.fixedOn ? state.target.key : '').split(':');
  const checkId = (kind === 'slice' || kind === 'zone') && ['short', 'mid', 'long'].includes(zone) ? `mix-${zone}` : null;
  const checks = checkId ? sets.filter((s) => family(s.drill) === checkId).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const cw = windows(checks, today);
  const check = compare(cw.recent.map(rate), cw.before.map(rate));

  // Rounds after a practice week against the rest, and the course overall, with the putter you use now.
  const rounds = [...scoped.rounds].filter((r) => r.holes.some((h) => h.putts.length)).sort((a, b) => a.date.localeCompare(b.date));
  const practiceDays = [
    ...sets.map((x) => ({ date: x.date, balls: x.attempts })),
    ...(state.practiceRounds ?? []).map((r) => ({ date: r.date, balls: r.holes.reduce((n, h) => n + h.putts.length, 0) })),
  ];
  const split = practiceSplit(rounds, practiceDays, state.baseline);
  const earlier = rounds.slice(-20, -10);
  const course = compare(
    rounds.slice(-10).map((r) => per18(r, state.baseline)),
    earlier.map((r) => per18(r, state.baseline)),
    3,
    3,
  );
  const lastRound = rounds.at(-1)?.date ?? null;
  const roundsQuiet = !lastRound || (Date.parse(today) - Date.parse(lastRound)) / 864e5 > 42;

  // Every other drill against its own earlier sets, from the last twelve weeks only.
  const recentSets = sets.filter((x) => {
    const age = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${x.date}T12:00:00Z`)) / 864e5;
    return age >= 0 && age < BEFORE_DAYS && x.drill !== TEST_ID && family(x.drill) !== checkId;
  });
  const byDrill = new Map<string, PracticeSet[]>();
  for (const x of recentSets) byDrill.set(family(x.drill), [...(byDrill.get(family(x.drill)) ?? []), x]);
  const drillReads = [...byDrill.entries()].map(([id, xs]) => {
    const surface = xs.at(-1)!.surface;
    return { id, name: resolveDrill(state, id)?.name ?? 'A drill', trend: trendOf(xs.filter((x) => x.surface === surface)) };
  });
  const counts = { up: 0, flat: 0, down: 0, waiting: 0 };
  for (const d of drillReads) counts[d.trend.verdict]++;
  const drillsVerdict: Verdict =
    counts.up + counts.flat + counts.down === 0
      ? 'early'
      : counts.up > counts.down
        ? counts.down === 0 && counts.up >= 2 ? 'better' : 'probably-better'
        : counts.down > counts.up
          ? counts.up === 0 && counts.down >= 2 ? 'worse' : 'probably-worse'
          : 'holding';

  // The status reads practice against your own earlier practice. Rounds are a check below it.
  const outcome =
    test.verdict !== 'early' ? test.verdict : check.verdict !== 'early' ? check.verdict : drillsVerdict !== 'early' ? drillsVerdict : null;
  const status = statusOf(recentWeeks >= 2, outcome);
  const firstNeed = test.verdict === 'early' ? test : check;
  const sentence =
    status === 'baseline'
      ? weekly.length || checks.length
        ? `${firstNeed.need} more ${firstNeed === test ? (firstNeed.need === 1 ? 'test' : 'tests') : firstNeed.need === 1 ? 'set' : 'sets'} and it can tell a good day from a better you.`
        : 'Take the weekly test or roll a drill a few times, and this starts comparing you with yourself.'
      : status === 'paying'
        ? 'You are practicing and your scores are above your normal.'
        : status === 'steady'
          ? recentWeeks >= 2
            ? 'You are practicing and holding your level.'
            : 'Holding your level with little practice lately.'
          : status === 'not-yet'
            ? 'You are practicing, but your scores are below your normal. Worth a look at what you are rolling.'
            : 'Not much practice lately, and your scores have dipped.';

  const maxSplit = Math.max(1, ...[split.compare.recent, split.compare.before].filter((x): x is number => x !== null).map(Math.abs));
  const bar = (v: number | null) => (v === null ? 0 : (Math.abs(v) / maxSplit) * 32);

  if (!sets.length && !rounds.length) return null;

  return (
    <>
      <h2>Is practice paying off</h2>
      <div className="pay-card">
        <span className="pay-eyebrow">Practice status</span>
        <strong className="pay-status">{STATUS_WORD[status]}</strong>
        <p>
          {sentence}
          {status === 'baseline' && test.verdict === 'early' && (
            <>
              {' '}
              <a className="pay-go" href="#/practice/test">
                Take the test ›
              </a>
            </>
          )}
        </p>
        <p className="pay-weeks-line">
          Practiced {weeks.filter(Boolean).length} of the last {weeks.length} weeks
          {practiceDates.length ? `, last on ${fmtDate([...practiceDates].sort().at(-1)!)}` : ''}.
        </p>

      </div>

      <div className="pay-rows">
        <Row
          title="Weekly test"
          c={test}
          unit="test"
          bars={<Bars values={weekly.slice(-12).map((t) => t.made)} max={weekly[0]?.attempts ?? 18} band={testBand} />}
          text={
            !weekly.length
              ? 'Eighteen putts, about six minutes. The first one sets your line.'
              : test.verdict === 'early'
                ? `${weekly.at(-1)!.made} of ${weekly.at(-1)!.attempts} on ${fmtDate(weekly.at(-1)!.date)}. ${test.need} more and it knows your normal week from a good one.`
                : `${test.recent!.toFixed(1)} a test over the last four weeks, ${test.before!.toFixed(1)} the eight before. Your normal swing is about ${test.swing!.toFixed(1)}.`
          }
        />
        {checkId && (
          <Row
            title="Target check"
            c={check}
            unit="set"
            bars={<Bars values={checks.slice(-12).map((s) => s.made)} max={checks[0]?.attempts ?? 12} />}
            text={
              !checks.length
                ? `${checkId === 'mix-short' ? 'Mixed 3 to 5' : checkId === 'mix-mid' ? 'Mixed 6 to 8' : 'Mixed 9 to 15'}, the same 12 putts each time. Roll it once to set your line.`
                : check.verdict === 'early'
                  ? `${checks.at(-1)!.made} of ${checks.at(-1)!.attempts} last time. ${check.need} more ${check.need === 1 ? 'set' : 'sets'} and it can compare.`
                  : `${Math.round(check.recent! * 100)}% over the last four weeks, ${Math.round(check.before! * 100)}% the eight before.`
            }
          />
        )}
        <Row
          title="Your drills"
          c={{ verdict: drillsVerdict, recent: null, before: null, swing: null, need: 0 }}
          unit="drill"
          text={
            drillsVerdict === 'early'
              ? counts.waiting
                ? `${counts.waiting} ${counts.waiting === 1 ? 'drill needs' : 'drills need'} a few more sets before each can be compared with itself.`
                : 'Roll any drill a few times and it gets compared with its own earlier sets.'
              : `Each drill against its own earlier sets: ${counts.up} up, ${counts.flat} holding, ${counts.down} down${counts.waiting ? `, ${counts.waiting} still building` : ''}.`
          }
        />
      </div>

      {rounds.length > 0 && (
        <div className="pay-course-card">
          <div className="pay-split-head">
            <strong>On the course</strong>
            <a href="#/stats" className="pay-course-go">
              Rounds ›
            </a>
          </div>
          <p className="pay-course-line">
            {course.verdict === 'early'
              ? `${course.need} more ${course.need === 1 ? 'round' : 'rounds'} before it can compare.`
              : `${PILL[course.verdict]}, your last 10 rounds against the ${earlier.length} before.`}
          </p>
        {roundsQuiet ? (
          <p className="pay-quiet light">
            {lastRound ? `Last round ${fmtDate(lastRound)}.` : 'No rounds yet.'} This picks back up with your next round, and every round
            within a week of practice counts toward it.
          </p>
        ) : (
          (split.after.length > 0 || split.without.length > 0) && (
            <div className="pay-split">
              <div className="pay-split-head">
                <strong>{split.mode === 'amount' ? 'More practice or less' : 'Rounds after a practice week'}</strong>
                <span className={`${pillClass(split.compare.verdict)}`}>{pillText(split.compare, 'round')}</span>
              </div>
              {[
                {
                  label: split.mode === 'amount' ? `${split.line}+ practice putts that week` : 'Within a week after practice',
                  v: split.compare.recent,
                  n: split.after.length,
                  me: true,
                },
                {
                  label: split.mode === 'amount' ? `Fewer than ${split.line}` : 'Weeks you did not',
                  v: split.compare.before,
                  n: split.without.length,
                  me: false,
                },
              ].map((x) => (
                <div key={x.label} className="pay-split-row">
                  <div className="pay-split-label">
                    <span>{x.label}</span>
                    <span>
                      {x.n} {x.n === 1 ? 'round' : 'rounds'}
                    </span>
                  </div>
                  <div className="pay-split-track">
                    <i className="pay-zero" />
                    {x.v !== null && (
                      <i
                        className={x.me ? 'pay-fill me' : 'pay-fill'}
                        style={x.v >= 0 ? { left: '50%', width: `${bar(x.v)}%` } : { right: '50%', width: `${bar(x.v)}%` }}
                      />
                    )}
                    {x.v !== null && (
                      <b style={x.v >= 0 ? { left: `calc(50% + ${bar(x.v)}% + 6px)` } : { right: `calc(50% + ${bar(x.v)}% + 6px)` }}>{signed(x.v, 1)}</b>
                    )}
                  </div>
                </div>
              ))}
              <p className="pay-note">
                Strokes gained putting a round{putterId ? `, ${putterName(state, putterId)}` : ''}. This shows what happened, not why: easier
                courses and good days move it too.
              </p>
            </div>
          )
        )}
        </div>
      )}
    </>
  );
}
