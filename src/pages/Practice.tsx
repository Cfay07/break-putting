import { useMemo, useState } from 'react';
import { Chevron } from '../components/Chevron';
import { DrillLogger } from '../components/DrillLogger';
import { PracticeDays } from '../components/PracticeDays';
import { SetColumns } from '../components/SetColumns';
import { Sheet } from '../components/Sheet';
import { ZoneBars } from '../components/ZoneBars';
import { distanceText, drillsFor, fits, resolveDrill, type Fitted } from '../lib/drills';
import { signed } from '../lib/format';
import {
  biggestGap,
  byTime,
  focusOf,
  histories,
  LEAN_TEXT,
  practiceVsPlay,
  totalsOf,
  type ZoneRead,
} from '../lib/practice';
import { clock, setScoreShort } from '../lib/practiceView';
import { confidenceOf } from '../lib/sample';
import { putterName } from '../lib/store';
import { usePractice } from '../lib/usePractice';
import { DEFAULT_BASELINE, SURFACE_LABELS, type Surface, type Zone } from '../lib/types';
import { useNow } from '../components/useNow';

const SURFACES: Surface[] = ['indoor', 'green'];

/** Enough to start one without scrolling; the rest are a tap away. */
const SESSIONS_SHOWN = 4;

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

function ZoneCard({
  z,
  worst,
  close,
  was,
  drills,
  surface,
  lastOf,
  onRoll,
}: {
  z: ZoneRead;
  worst: boolean;
  close: ZoneRead | null;
  /** The season's biggest leak, when it is no longer the recent one. */
  was: { label: string; sgPerRound: number; rounds: number } | null;
  drills: Fitted[];
  surface: Surface;
  lastOf: (id: string) => string | null;
  onRoll: (d: Fitted) => void;
}) {
  const thin = confidenceOf(z.sample) === 'waiting';
  const readMiss = z.lean && (z.lean.lean === 'high' || z.lean.lean === 'low');
  return (
    <div className={`card focus-card${z.sgPerRound < 0 && !thin ? ' lose' : ''}`}>
      <div className="focus-head">
        <h3>{z.label}</h3>
        {worst && <span className="focus-tag">Biggest leak</span>}
      </div>
      {thin ? (
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          {z.attempts} putts from here so far, too few to say what it costs.
        </p>
      ) : (
        <>
          <div className="focus-num num">{signed(z.sgPerRound)}</div>
          <p className="small muted focus-sub">
            strokes a round · {signed(z.sgPerPutt)} a putt · {z.makes} of {z.attempts} holed
            {confidenceOf(z.sample) === 'thin' && ' · thin sample'}
          </p>
          {close && (
            <p className="small muted focus-sub">
              {close.label} is close behind at {signed(close.sgPerRound)}, near enough to be a tie.
            </p>
          )}
          {was && (
            <p className="small muted focus-sub">
              Over all {was.rounds} rounds the biggest leak was {was.label.toLowerCase()} ({signed(was.sgPerRound)}).
              Lately it is this one instead.
            </p>
          )}
        </>
      )}
      {z.lean && (
        <p className="small focus-lean">
          {z.lean.n} of {z.lean.of} tagged misses from here {LEAN_TEXT[z.lean.lean]}.
          {readMiss && surface === 'indoor' && ' A flat surface has no break, so the read side of that waits for a green.'}
        </p>
      )}
      <div className="focus-drills">
        {drills.map((d) => (
          <button key={d.id} className="focus-drill" onClick={() => onRoll(d)}>
            <span>
              <strong>{d.name}</strong>
              <span className="small muted"> · {distanceText(d)}</span>
            </span>
            <span className="small muted num">{lastOf(d.id) ?? 'Start'}</span>
          </button>
        ))}
        {!drills.length && (
          <p className="small muted" style={{ margin: 0 }}>
            Nothing you have for this distance fits {surface === 'indoor' ? 'indoors' : 'on a green'} yet.
          </p>
        )}
      </div>
    </div>
  );
}

function RoomSheet({ onClose }: { onClose: () => void }) {
  const { dispatch, surface, room } = usePractice();
  const set = (feet: number) => dispatch({ t: 'setRoom', surface, feet: Math.max(3, Math.min(90, feet)) });
  return (
    <Sheet title="Room to putt" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        The longest putt you have room for {surface === 'indoor' ? 'indoors' : 'on the green you use'}. Every
        drill fits itself to it: a station past it moves in, and a drill that starts past it stays hidden.
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

export function Practice() {
  const { state, dispatch, surface, room, putterId, scoped, family, fitted, drills } = usePractice();
  const [rolling, setRolling] = useState<Fitted | null>(null);
  const [picked, setPicked] = useState<Zone | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const now = useNow(!!state.run, 1000);

  const focus = useMemo(() => focusOf(state.rounds, state.baseline, putterId), [state.rounds, state.baseline, putterId]);
  const zone = focus.zones.find((z) => z.zone === (picked ?? focus.worst)) ?? null;
  const sets = state.practice;
  const list = histories(sets, family);
  const totals = totalsOf(sets);
  const games = sets.filter((s) => s.game);

  const lastOf = (id: string) => {
    const h = list.find((x) => x.drill === family(id));
    return h ? `Last ${setScoreShort(resolveDrill(state, id), h.last)}` : null;
  };

  const scratch = JSON.stringify(state.baseline) === JSON.stringify(DEFAULT_BASELINE);
  const recentWord = focus.allRounds > focus.rounds ? `last ${focus.rounds}` : `${focus.rounds}`;
  const scope =
    focus.putterOnly && putterId
      ? `your ${recentWord} rounds with the ${putterName(state, putterId)}`
      : `your ${recentWord} rounds`;

  const runSession = state.run ? state.sessions.find((x) => x.id === state.run!.session) : undefined;
  // Sessions you have rolled lately first, then the rest in the order they came in.
  const lastRolled = new Map<string, string>();
  for (const x of sets) if (x.session && (lastRolled.get(x.session) ?? '') < x.date) lastRolled.set(x.session, x.date);
  const recentSessions = [...state.sessions].sort((a, b) => (lastRolled.get(b.id) ?? '').localeCompare(lastRolled.get(a.id) ?? ''));
  const allReads = useMemo(() => practiceVsPlay(sets, scoped.rounds), [sets, scoped.rounds]);
  const record = useMemo(() => {
    const m = new Map<string, { w: number; l: number; t: number }>();
    for (const s of games) {
      const r = m.get(s.game!.opponent) ?? { w: 0, l: 0, t: 0 };
      if (s.game!.result === 'win') r.w++;
      else if (s.game!.result === 'loss') r.l++;
      else r.t++;
      m.set(s.game!.opponent, r);
    }
    return [...m.entries()].sort((a, b) => b[1].w - a[1].w || a[1].l - b[1].l);
  }, [games]);

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

      {focus.rounds > 0 && zone && (
        <>
          <h2>Work on</h2>
          <ZoneCard
            z={zone}
            worst={zone.zone === focus.worst}
            close={zone.zone === focus.worst ? (focus.zones.find((z) => z.zone === focus.close) ?? null) : null}
            was={
              zone.zone === focus.worst && focus.wasWorst
                ? { label: focus.wasWorst.label, sgPerRound: focus.wasWorst.sgPerRound, rounds: focus.allRounds }
                : null
            }
            drills={drillsFor(drills, zone.zone, zone.lean?.lean ?? null, surface, room)}
            surface={surface}
            lastOf={lastOf}
            onRoll={setRolling}
          />
          <h2>Where the strokes go</h2>
          <ZoneBars zones={focus.zones} on={zone.zone} onPick={setPicked} />
          <p className="small muted" style={{ marginTop: 8 }}>
            Strokes a round against {scratch ? 'scratch' : 'your baseline'}, from {scope}, already adjusted for
            distance. A wide zone holds more putts a round, so each row also says what one putt costs. Tap a distance
            for its drills.
          </p>
        </>
      )}

      <h2>Sessions</h2>
      <div className="row-list">
        {recentSessions.slice(0, SESSIONS_SHOWN).map((x) => (
          <SessionRow key={x.id} id={x.id} />
        ))}
        {state.sessions.length > SESSIONS_SHOWN && (
          <a className="nav-row" href="#/practice/sessions">
            <span className="nav-main">
              <strong>All {state.sessions.length} sessions</strong>
            </span>
            <Chevron />
          </a>
        )}
        <a className="btn btn-ghost btn-wide" href="#/practice/session-edit/new">
          Build a session
        </a>
      </div>
      {!state.sessions.length && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Your team's practice file comes in from Settings, under Practice files.
        </p>
      )}

      {list.length > 0 && (
        <>
          <h2>Your drills</h2>
          <div className="row-list">
            {list.map((h) => {
              const d = fitted(h.drill) ?? resolveDrill(state, h.drill);
              if (!d) return null;
              const gap = biggestGap(practiceVsPlay(h.sets, scoped.rounds));
              return (
                <a key={h.drill} className="drill-row" href={`#/practice/drill/${h.drill}`}>
                  <span className="drill-main">
                    <strong>{d.name}</strong>
                    <span className="small muted">
                      {gap ? (
                        <>
                          {gap.d} ft: {Math.round((gap.practice.made / gap.practice.attempts) * 100)}% here,{' '}
                          <span className="play-ink">{Math.round((gap.play.made / gap.play.attempts) * 100)}% in rounds</span>
                        </>
                      ) : (
                        `${h.sets.length} ${h.sets.length === 1 ? 'set' : 'sets'} · best ${setScoreShort(d, h.best)}`
                      )}
                    </span>
                  </span>
                  <SetColumns h={h} />
                  <span className="drill-last num">{setScoreShort(d, h.last)}</span>
                </a>
              );
            })}
          </div>
        </>
      )}

      <div className="row-list" style={{ marginTop: list.length ? 8 : 18 }}>
        <a className="nav-row" href="#/practice/drills">
          <span className="nav-main">
            <strong>Browse every drill</strong>
            <span className="small muted">BREAK!'s, imported, and yours, or build one</span>
          </span>
          <Chevron />
        </a>
        {sets.some((x) => x.stations?.some((st) => st.hand)) && (
          <a className="nav-row" href="#/practice/hands">
            <span className="nav-main">
              <strong>One hand at a time</strong>
              <span className="small muted">Left against right, and against your rounds</span>
            </span>
            <Chevron />
          </a>
        )}
        {allReads.some((r) => r.gap !== null) && (
          <a className="nav-row" href="#/practice/distances">
            <span className="nav-main">
              <strong>Practice against play</strong>
              <span className="small muted">Every distance, side by side</span>
            </span>
            <Chevron />
          </a>
        )}
      </div>

      {record.length > 0 && (
        <>
          <h2>Head to head</h2>
          {record.map(([who, r]) => (
            <div key={who} className="stat-row">
              <span className="k">{who}</span>
              <span className="v num">
                {r.w}-{r.l}
                {r.t ? `-${r.t}` : ''}
              </span>
            </div>
          ))}
        </>
      )}

      {sets.length > 0 && (
        <>
          <h2>Days you practiced</h2>
          <p className="small muted" style={{ margin: '0 0 8px' }}>
            {totals.sets} {totals.sets === 1 ? 'set' : 'sets'}, {totals.putts} putts, {totals.days}{' '}
            {totals.days === 1 ? 'day' : 'days'}. None of it counts toward your round stats.
          </p>
          <PracticeDays sets={[...sets].sort(byTime)} />
        </>
      )}

      {roomOpen && <RoomSheet onClose={() => setRoomOpen(false)} />}
      {rolling && <DrillLogger key={rolling.id} drill={rolling} surface={surface} onClose={() => setRolling(null)} />}
    </div>
  );
}
