import { useState } from 'react';
import { Chevron } from '../components/Chevron';
import { DrillLogger } from '../components/DrillLogger';
import { DrillPreview } from '../components/DrillPreview';
import { Sheet } from '../components/Sheet';
import { useNow } from '../components/useNow';
import { distanceText, fits, fitToRoom, resolveDrill, type Fitted } from '../lib/drills';
import { fmtDate, today } from '../lib/format';
import { histories } from '../lib/practice';
import { clock, setScoreShort } from '../lib/practiceView';
import { go } from '../lib/router';
import { liveRound, makeRound } from '../lib/store';
import { CHECK_AFTER, TARGET_SESSION, useTarget } from '../lib/useTarget';
import { usePractice } from '../lib/usePractice';
import { SURFACE_LABELS, type SessionDef, type Surface } from '../lib/types';
import { loadTestRun, nextTestDay, testDrill } from '../lib/weeklyTest';

const BLOCK_MIN = 4;

const SURFACES: Surface[] = ['indoor', 'green'];

/** Enough to start one without scrolling; the rest are a tap away. */
const SESSIONS_SHOWN = 3;

export function SessionRow({ id }: { id: string }) {
  const { state, surface } = usePractice();
  const x = state.sessions.find((s) => s.id === id);
  if (!x) return null;
  const blocks = x.blocks.filter((b) => resolveDrill(state, b.drill)?.putting !== false);
  if (!blocks.length) return null;
  const mins = blocks.reduce((n, b) => n + (b.minutes ?? 0), 0);
  const off = blocks.filter((b) => {
    const d = resolveDrill(state, b.drill);
    return d && !fits(d, surface);
  }).length;
  return (
    <a className="nav-row" href={`#/practice/session/${x.id}`}>
      <span className="nav-main">
        <strong>{x.name}</strong>
        <span className="small muted">
          {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
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

export function Practice() {
  const target = useTarget();
  const { state, dispatch, surface, room, family } = target.plan;
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

  const test = target.test;
  const testRun = fitToRoom(testDrill(room, surface, date), room);
  const lastTest = test.weeks.filter((s) => s !== test.thisWeek).at(-1) ?? null;
  const testGoing = loadTestRun(testRun.stations);

  const { title, lines, picks, check, beat, testIsTarget, hasWhy, setOn, progress, markFixed } = target;
  const plan = testIsTarget
    ? []
    : beat
      ? [picks[0], beat, check ?? picks[1]].filter((d, i, all): d is Fitted => !!d && all.findIndex((x) => x?.id === d.id) === i)
      : [...picks, ...(check ? [check] : [])];
  const startPlan = () => {
    if (state.run?.session !== TARGET_SESSION) {
      const session: SessionDef = {
        id: TARGET_SESSION,
        name: title,
        source: 'mine',
        blocks: plan.map((d) => ({ drill: d.id, minutes: BLOCK_MIN })),
      };
      dispatch({ t: 'saveSession', session });
      dispatch({ t: 'startRun', session: TARGET_SESSION, surface });
    }
    go(`/practice/session/${TARGET_SESSION}`);
  };

  const runSession = state.run ? state.sessions.find((x) => x.id === state.run!.session) : undefined;
  // Sessions you have rolled lately first, then the rest in the order they came in.
  const lastRolled = new Map<string, string>();
  for (const x of sets) if (x.session && (lastRolled.get(x.session) ?? '') < x.date) lastRolled.set(x.session, x.date);
  const mySessions = state.sessions.filter((x) => x.id !== TARGET_SESSION);
  const recentSessions = [...mySessions].sort((a, b) =>
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

      <div className="target-card">
        <span className="target-eyebrow">Your target{setOn ? ` · since ${fmtDate(setOn)}` : ''}</span>
        <h3>{title}</h3>
        {progress?.fixed ? (
          <>
            <p>
              Fixed. Since {fmtDate(setOn!)}: {progress.after.made} of {progress.after.attempts} on the course, against{' '}
              {progress.before.made} of {progress.before.attempts} before. That gap is past chance. It does not prove the
              drills did it.
            </p>
            <button className="target-next" onClick={markFixed}>
              Next target
            </button>
          </>
        ) : (
          <>
            {lines[0] && <p>{lines[0]}</p>}
            {progress && (
              <p className="target-progress">
                {progress.after.attempts < CHECK_AFTER
                  ? `${progress.after.attempts} of ${CHECK_AFTER} course putts toward a check.`
                  : `Since ${fmtDate(setOn!)}: ${progress.after.made} of ${progress.after.attempts} on the course, ${progress.before.made} of ${progress.before.attempts} before. Not past chance yet.`}
              </p>
            )}
          </>
        )}
        {testIsTarget && !test.thisWeek && (
          <button className="target-next" onClick={() => setPreview({ drill: testRun, once: true })}>
            {testGoing ? `Pick up at ball ${testGoing.balls.length + 1}` : 'Start the test'}
          </button>
        )}
        {hasWhy && (
          <a className="target-why" href="#/practice/why">
            Why this ›
          </a>
        )}
      </div>

      {plan.length > 0 && (
        <>
          <h2>Today's {plan.length * BLOCK_MIN} minutes</h2>
          <ol className="plan-list">
            {plan.map((d, i) => (
              <li key={d.id}>
                <span className="plan-n">{i + 1}</span>
                <button className="plan-main" onClick={() => setPreview({ drill: d })}>
                  <strong>{d.name}</strong>
                  <span className="small muted">
                    {[distanceText(d), d.beat ? 'with the beat' : '', lastOf(d.id)].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <span className="small muted">{BLOCK_MIN} min</span>
              </li>
            ))}
          </ol>
          {surface === 'indoor' && target.kind === 'slice' && (
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              A flat mat trains start line and speed. The read needs real slope, so on a sloped green switch to Green.
            </p>
          )}
          <button className="btn btn-primary btn-wide" style={{ marginTop: 12 }} onClick={startPlan}>
            {runSession?.id === TARGET_SESSION ? 'Back to it' : `Start · ${plan.length * BLOCK_MIN} min`}
          </button>
        </>
      )}

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
                    {testGoing
                      ? `Stopped at ball ${testGoing.balls.length + 1}. It picks up from there.`
                      : lastTest && test.best
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
        {mySessions.length > SESSIONS_SHOWN ? (
          <a className="nav-row" href="#/practice/sessions">
            <span className="nav-main">
              <strong>All {mySessions.length} sessions</strong>
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
      {!mySessions.length && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Your team's practice file comes in from Settings, under Imports.
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
        <a className="nav-row" href="#/practice/tempo">
          <span className="nav-main">
            <strong>Metronome</strong>
            <span className="small muted">Back, top, hit. Quiet, and it buzzes on Android</span>
          </span>
          <Chevron />
        </a>
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
