import { useState } from 'react';
import { Chevron } from '../components/Chevron';
import { DrillLogger } from '../components/DrillLogger';
import { DrillPreview } from '../components/DrillPreview';
import { Sheet } from '../components/Sheet';
import { useNow } from '../components/useNow';
import { drillsNear, fits, fitToRoom, resolveDrill, type Fitted } from '../lib/drills';
import { fmtDate, today } from '../lib/format';
import { COND_LABEL } from '../lib/pinpoint';
import { histories, LEAN_TEXT } from '../lib/practice';
import { clock, setScoreShort } from '../lib/practiceView';
import { go } from '../lib/router';
import { liveRound, makeRound } from '../lib/store';
import { daysBetween, STALE_DAYS, targetKind } from '../lib/target';
import { usePlan } from '../lib/usePlan';
import { usePractice } from '../lib/usePractice';
import { isLagZone, SURFACE_LABELS, type Surface } from '../lib/types';
import { nextTestDay, testDrill, testParts, testStatus } from '../lib/weeklyTest';
import { DIR_MEANS } from './PracticeWhy';

const SURFACES: Surface[] = ['indoor', 'green'];

/** Enough to start one without scrolling; the rest are a tap away. */
const SESSIONS_SHOWN = 3;

export function SessionRow({ id }: { id: string }) {
  const { state, surface } = usePractice();
  const x = state.sessions.find((s) => s.id === id);
  if (!x) return null;
  const mins = x.blocks.reduce((n, b) => n + (b.minutes ?? 0), 0);
  const off = x.blocks.filter((b) => {
    const d = resolveDrill(state, b.drill);
    return d?.putting && !fits(d, surface);
  }).length;
  return (
    <a className="nav-row" href={`#/practice/session/${x.id}`}>
      <span className="nav-main">
        <strong>{x.name}</strong>
        <span className="small muted">
          {x.blocks.length} {x.blocks.length === 1 ? 'block' : 'blocks'}
          {mins ? ` · ${mins} min` : ''}
          {off ? ` · ${off} need a green` : ''}
        </span>
      </span>
      <Chevron />
    </a>
  );
}

function RoomSheet({ onClose }: { onClose: () => void }) {
  const { dispatch, surface, room } = usePractice();
  const set = (feet: number) => dispatch({ t: 'setRoom', surface, feet: Math.max(3, Math.min(90, feet)) });
  return (
    <Sheet title="Room to putt" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        The longest putt you have room for {surface === 'indoor' ? 'indoors' : 'on the green you use'}. Every
        drill fits itself to it: a station past it moves in.
      </p>
      <div className="step-row">
        <span className="step-k">
          <strong>{SURFACE_LABELS[surface]}</strong>
        </span>
        <button className="step-btn" aria-label="Shorter" onClick={() => set(room - 1)}>
          −
        </button>
        <span className="step-v num">
          {room}
          <span className="muted"> ft</span>
        </span>
        <button className="step-btn on" aria-label="Longer" onClick={() => set(room + 1)}>
          +
        </button>
      </div>
    </Sheet>
  );
}

function RoundSheet({ onClose }: { onClose: () => void }) {
  const { dispatch, surface, putterId } = usePractice();
  // Anywhere from nine to eighteen: short enough to fit a session, long enough to mean something.
  const [holeCount, setHoleCount] = useState(9);
  const start = () => {
    if (!putterId) return;
    const round = makeRound({ date: today(), putterId, holeCount });
    dispatch({ t: 'newRound', round: { ...round, label: 'Practice round', practice: { surface } } });
    go('/track');
  };
  return (
    <Sheet title="Practice round" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Every putt logged like a round, with no score. It never counts toward your round stats.
      </p>
      <div className="round-start">
        <span className="mini-step">
          <button aria-label="One hole fewer" disabled={holeCount <= 9} onClick={() => setHoleCount(holeCount - 1)}>
            −
          </button>
          <span className="num">
            {holeCount}
            <span className="muted"> holes</span>
          </span>
          <button aria-label="One hole more" disabled={holeCount >= 18} onClick={() => setHoleCount(holeCount + 1)}>
            +
          </button>
        </span>
        <button className="btn btn-primary" disabled={!putterId} onClick={start}>
          Start
        </button>
      </div>
    </Sheet>
  );
}

const unique = (ds: (Fitted | null | undefined)[]): Fitted[] => {
  const seen = new Set<string>();
  return ds.filter((d): d is Fitted => !!d && !seen.has(d.id) && !!seen.add(d.id));
};

export function Practice() {
  const plan = usePlan();
  const { state, dispatch, surface, room, drills, fitted, family, focus, worst, whyOf, habits, pattern, patternFix, scope, lastRound } =
    plan;
  const [rolling, setRolling] = useState<{ drill: Fitted; once?: boolean } | null>(null);
  // A tap shows what the drill is; only Start opens the counter.
  const [preview, setPreview] = useState<{ drill: Fitted; once?: boolean } | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [roundOpen, setRoundOpen] = useState(false);
  const now = useNow(!!state.run, 1000);

  const date = today();
  const sets = state.practice;
  const list = histories(sets, family);
  const lastOf = (id: string) => {
    const h = list.find((x) => x.drill === family(id));
    return h ? `Last ${setScoreShort(resolveDrill(state, id), h.last)}` : null;
  };
  const live = liveRound(state);

  const test = testStatus(sets, surface, room, date);
  const testRun = fitToRoom(testDrill(room, surface, date), room);
  const lastTest = test.weeks.filter((s) => s !== test.thisWeek).at(-1) ?? null;

  const why = worst ? whyOf(worst) : [];
  const slice = why[0] ?? null;
  const kind = targetKind({ zone: worst, slice: slice?.slice ?? null, habit: habits[0] ?? null, pattern, lastRound, today: date });
  const stale = !lastRound || daysBetween(lastRound, date) > STALE_DAYS;
  const zoneDrills = worst ? drillsNear(drills, worst.zone, worst.lean?.lean ?? null, surface, room) : [];
  const pct = (n: number, of: number) => Math.round((n / of) * 100);
  const fromPractice =
    pattern && kind !== 'practice'
      ? `In practice, ${pattern.n} of your last ${pattern.of} tagged misses from ${pattern.band.replace(' and out', ' and longer')} went ${pattern.dir}.`
      : null;

  let title: string;
  const lines: string[] = [];
  let picks: Fitted[] = [];
  if (kind === 'slice' && worst && slice) {
    const s = slice.slice;
    const lag = isLagZone(worst.zone);
    title = `${COND_LABEL[s.cond]}, ${lag ? '16 ft and out' : worst.label}`;
    lines.push(
      `${s.made} of ${s.attempts} ${lag ? 'finished within 3 ft' : 'holed'} in ${scope}, against ${pct(s.restMade, s.restAttempts)}% on your other tagged putts from there.`,
    );
    if (s.lean) lines.push(`${s.lean.n} of ${s.lean.of} tagged misses ${LEAN_TEXT[s.lean.lean]}.`);
    picks = unique([slice.fix, fromPractice ? patternFix : null, ...zoneDrills]);
  } else if (kind === 'zone' && worst) {
    title = worst.label;
    const cost = `It costs ${Math.abs(worst.sgPerRound).toFixed(2)} strokes a round.`;
    lines.push(
      isLagZone(worst.zone)
        ? `${worst.leave !== null ? `You leave it ${worst.leave.toFixed(1)} ft away on average, with` : 'You have'} ${worst.threePutts} three-putts in ${worst.firstPutts}, in ${scope}. ${cost}`
        : `${worst.makes} of ${worst.attempts} holed in ${scope}, where a scratch golfer makes ${pct(worst.scratchMakes, worst.attempts)}%. ${cost}`,
    );
    if (worst.lean) {
      const read = worst.lean.lean === 'high' || worst.lean.lean === 'low';
      lines.push(
        `${worst.lean.n} of ${worst.lean.of} tagged misses from there ${LEAN_TEXT[worst.lean.lean]}.` +
          (read && surface === 'indoor' ? ' A flat mat cannot train the read, so that part waits for a green.' : ''),
      );
    }
    picks = unique([zoneDrills[0], fromPractice ? patternFix : null, ...zoneDrills.slice(1)]);
  } else if (kind === 'habit') {
    const h = habits[0];
    title = h.title;
    lines.push(h.detail);
    picks = unique([fitted(h.fix), fromPractice ? patternFix : null]);
  } else if (kind === 'practice' && pattern) {
    title = `${pattern.band}, ${SURFACE_LABELS[pattern.surface].toLowerCase()}`;
    lines.push(`${pattern.n} of your last ${pattern.of} tagged misses went ${pattern.dir}. ${DIR_MEANS[pattern.dir]}`);
    if (lastRound && stale) {
      lines.push(`Your last round was ${fmtDate(lastRound)}, so this comes from your practice. New rounds take it back.`);
    }
    picks = unique([patternFix]);
  } else if (test.thisWeek) {
    const t = testParts(test.thisWeek, state.baseline);
    title = `This week's test: ${test.thisWeek.made} of ${test.thisWeek.attempts}`;
    lines.push(
      `Holed ${t.holed} of ${t.of}, where a scratch golfer averages ${t.scratch.toFixed(1)}. ${t.inside} of ${t.lags} lag putts finished close.`,
    );
    lines.push(`The next one opens ${fmtDate(nextTestDay(date))}. Until then, mix these in.`);
    const short = drillsNear(drills, 'mid', null, surface, room)[0];
    const long = drillsNear(drills, 'far', null, surface, room)[0];
    picks = unique(t.holed < t.scratch ? [short, long] : [long, short]);
  } else {
    title = 'Take the weekly test';
    lines.push(
      !focus.rounds
        ? 'Eighteen putts, about six minutes, no rounds needed. Your rounds name a target once there are enough of them, and until then this is the number that shows you getting better.'
        : worst && worst.sgPerRound >= 0
          ? `You beat scratch from every distance in ${scope}. The test is how you keep it that way week to week.`
          : `${focus.rounds} ${focus.rounds === 1 ? 'round' : 'rounds'} in, too few putts from any one distance to name a target yet. Eighteen putts, about six minutes, and it is the number to beat every week.`,
    );
  }
  if (fromPractice && kind !== 'test') lines.push(fromPractice);
  // A leak with one drill gets your strongest stroke habit as the second, said out loud.
  const habitFix = habits[0] ? fitted(habits[0].fix) : null;
  if ((kind === 'zone' || kind === 'slice') && picks.length < 2 && habitFix && !picks.some((d) => d.id === habitFix.id)) {
    lines.push(habits[0].detail);
    picks.push(habitFix);
  }
  picks = picks.slice(0, 2);
  const testIsTarget = kind === 'test';
  const hasWhy = focus.rounds > 0 || habits.length > 0 || !!pattern;

  const runSession = state.run ? state.sessions.find((x) => x.id === state.run!.session) : undefined;
  // Sessions you have rolled lately first, then the rest in the order they came in.
  const lastRolled = new Map<string, string>();
  for (const x of sets) if (x.session && (lastRolled.get(x.session) ?? '') < x.date) lastRolled.set(x.session, x.date);
  const recentSessions = [...state.sessions].sort((a, b) =>
    (lastRolled.get(b.id) ?? '').localeCompare(lastRolled.get(a.id) ?? ''),
  );

  return (
    <div>
      <div className="seg seg-quiet" role="group" aria-label="Where you are putting">
        {SURFACES.map((s) => (
          <button key={s} aria-pressed={surface === s} onClick={() => dispatch({ t: 'setSurface', surface: s })}>
            {SURFACE_LABELS[s]}
          </button>
        ))}
      </div>
      <button className="room-line" onClick={() => setRoomOpen(true)}>
        <span>
          Longest putt you have room for <strong>{room} ft</strong>
        </span>
        <span className="room-change">Change</span>
      </button>

      {runSession && (
        <a className="card run-banner" href={`#/practice/session/${runSession.id}`}>
          <span>
            <strong>{runSession.name}</strong>
            <span className="small muted"> · going now</span>
          </span>
          <span className="num">{clock((now - Date.parse(state.run!.startedAt)) / 1000)}</span>
        </a>
      )}

      <h2>Your target</h2>
      <div className="card target">
        <h3>{title}</h3>
        {lines.map((l) => (
          <p key={l} className="small muted">
            {l}
          </p>
        ))}
        {picks.map((d) => (
          <button key={d.id} className="target-drill" onClick={() => setPreview({ drill: d })}>
            <strong>{d.name}</strong>
            <span className="small muted num">{lastOf(d.id) ?? 'Start'}</span>
          </button>
        ))}
        {testIsTarget && !test.thisWeek && (
          <button className="btn btn-primary btn-wide" onClick={() => setPreview({ drill: testRun, once: true })}>
            Start the test
          </button>
        )}
        {hasWhy && (
          <a className="target-why" href="#/practice/why">
            Why this, and where the strokes go ›
          </a>
        )}
      </div>

      {!testIsTarget && (
        <>
          <h2>Weekly test</h2>
          <button className="nav-row" onClick={() => setPreview({ drill: testRun, once: true })}>
            <span className="nav-main">
              {test.thisWeek ? (
                <>
                  <strong>
                    This week: {test.thisWeek.made} of {test.thisWeek.attempts}
                  </strong>
                  <span className="small muted">
                    {test.best && test.weeks.length > 1 ? `Best ${test.best.made}. ` : ''}The next one opens{' '}
                    {fmtDate(nextTestDay(date))}.
                  </span>
                </>
              ) : (
                <>
                  <strong>Due · 18 putts, about 6 min</strong>
                  <span className="small muted">
                    {lastTest && test.best
                      ? `${lastTest.made} of ${lastTest.attempts} last time, best ${test.best.made}`
                      : 'The first one sets the number to beat.'}
                  </span>
                </>
              )}
            </span>
            <Chevron />
          </button>
        </>
      )}

      <h2>Sessions</h2>
      <div className="row-list">
        {recentSessions.slice(0, SESSIONS_SHOWN).map((x) => (
          <SessionRow key={x.id} id={x.id} />
        ))}
        {state.sessions.length > SESSIONS_SHOWN ? (
          <a className="nav-row" href="#/practice/sessions">
            <span className="nav-main">
              <strong>All {state.sessions.length} sessions</strong>
              <span className="small muted">Or build one</span>
            </span>
            <Chevron />
          </a>
        ) : (
          <a className="btn btn-ghost btn-wide" href="#/practice/session-edit/new">
            Build a session
          </a>
        )}
      </div>
      {!state.sessions.length && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Your team's practice file comes in from Settings, under Practice files.
        </p>
      )}

      <div className="row-list" style={{ marginTop: 24 }}>
        {live && !live.practice ? (
          <div className="nav-row" aria-disabled="true">
            <span className="nav-main">
              <strong>Practice round</strong>
              <span className="small muted">Finish or discard the round you are logging first.</span>
            </span>
          </div>
        ) : live ? (
          <a className="nav-row" href="#/track">
            <span className="nav-main">
              <strong>Back to your practice round</strong>
              <span className="small muted">{live.holes.filter((h) => h.putts.length).length} holes logged</span>
            </span>
            <Chevron />
          </a>
        ) : (
          <button className="nav-row" onClick={() => setRoundOpen(true)}>
            <span className="nav-main">
              <strong>Practice round</strong>
              <span className="small muted">9 to 18 holes, every putt logged</span>
            </span>
            <Chevron />
          </button>
        )}
        <a className="nav-row" href="#/practice/drills">
          <span className="nav-main">
            <strong>Every drill</strong>
            <span className="small muted">BREAK!'s, imported, and yours, or build one</span>
          </span>
          <Chevron />
        </a>
      </div>

      {roomOpen && <RoomSheet onClose={() => setRoomOpen(false)} />}
      {roundOpen && <RoundSheet onClose={() => setRoundOpen(false)} />}
      {preview && (
        <DrillPreview
          drill={preview.drill}
          onClose={() => setPreview(null)}
          onStart={() => {
            setRolling(preview);
            setPreview(null);
          }}
        />
      )}
      {rolling && (
        <DrillLogger
          key={rolling.drill.id}
          drill={rolling.drill}
          surface={surface}
          once={rolling.once}
          onClose={() => setRolling(null)}
        />
      )}
    </div>
  );
}
