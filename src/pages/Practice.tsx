import { useMemo, useState } from 'react';
import { Chevron } from '../components/Chevron';
import { DrillLogger } from '../components/DrillLogger';
import { DrillPreview } from '../components/DrillPreview';
import { Sheet } from '../components/Sheet';
import { ZoneBars } from '../components/ZoneBars';
import { distanceText, drillsFor, fits, fitToRoom, resolveDrill, type Fitted } from '../lib/drills';
import { fmtDate, signed, today } from '../lib/format';
import {
  focusOf,
  histories,
  LEAN_TEXT,
  totalsOf,
  type ZoneRead,
} from '../lib/practice';
import { clock, setScoreShort } from '../lib/practiceView';
import { confidenceOf } from '../lib/sample';
import { liveRound, makeRound, putterName } from '../lib/store';
import { go } from '../lib/router';
import { usePractice } from '../lib/usePractice';
import { DEFAULT_BASELINE, SURFACE_LABELS, type Surface, type Zone } from '../lib/types';
import { useNow } from '../components/useNow';
import { COND_LABEL, fixDrill, fixFor, pinpoint, practiceFix, practicePattern, SLICE_NEED, sliceSince, type Slice } from '../lib/pinpoint';
import { isLagZone, type MissDir } from '../lib/types';

const SURFACES: Surface[] = ['indoor', 'green'];

const NEXT_DOOR: Record<Zone, Zone[]> = {
  tapin: ['short'],
  short: ['tapin', 'mid'],
  mid: ['short', 'long'],
  long: ['mid', 'far'],
  far: ['long', 'lag'],
  lag: ['far', 'deep'],
  deep: ['lag'],
};

/** Drills for a zone, or the nearest real ones when none land squarely in it. Never an empty card. */
function drillsNear(...args: Parameters<typeof drillsFor>): Fitted[] {
  const [all, zone, lean, surface, room] = args;
  const here = drillsFor(all, zone, lean, surface, room);
  if (here.length) return here;
  for (const z of NEXT_DOOR[zone]) {
    const near = drillsFor(all, z, lean, surface, room);
    if (near.length) return near;
  }
  return [];
}

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
  toWorst,
  why,
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
  /** Back to the zone worth working on, from one that is holding up. */
  toWorst?: () => void;
  why: WhyItem[];
}) {
  const thin = confidenceOf(z.sample) === 'waiting';
  const holding = !thin && z.sgPerRound >= 0;
  const readMiss = z.lean && (z.lean.lean === 'high' || z.lean.lean === 'low');
  return (
    <div className={`card focus-card${z.sgPerRound < 0 && !thin ? ' lose' : holding ? ' hold' : ''}`}>
      <div className="focus-head">
        <h3>{z.label}</h3>
        {worst && <span className="focus-tag">Biggest leak</span>}
        {holding && <span className="focus-tag good">Holding up</span>}
      </div>
      {thin ? (
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          {z.attempts} putts from here so far, too few to say what it costs.
        </p>
      ) : (
        <>
          <div className="focus-num num">{signed(z.sgPerRound)}</div>
          <p className="small muted focus-sub">
            strokes a round against scratch{confidenceOf(z.sample) === 'thin' && ' · thin sample'}
          </p>
          <ZoneStats z={z} />
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
      {holding ? (
        <>
          <p className="small focus-lean">
            You beat scratch from here, so there is nothing to fix. The strokes are going somewhere else.
          </p>
          {toWorst && (
            <button className="btn btn-wide" style={{ marginTop: 12 }} onClick={toWorst}>
              Show the biggest leak
            </button>
          )}
        </>
      ) : (
      <>
      {why.length > 0 && (
        <div className="why-list">
          <span className="why-h">What's behind it</span>
          {why.map((w) => (
            <div key={w.slice.cond} className="why-item">
              <strong>
                {COND_LABEL[w.slice.cond]}: {w.slice.made} of {w.slice.attempts} {isLagZone(z.zone) ? 'finished within 3 ft' : 'holed'}
              </strong>
              <span className="small muted">
                {Math.round((w.slice.made / w.slice.attempts) * 100)}% against{' '}
                {Math.round((w.slice.restMade / w.slice.restAttempts) * 100)}% on your other tagged putts from here
                {w.slice.lean ? `. ${w.slice.lean.n} of ${w.slice.lean.of} tagged misses ${LEAN_TEXT[w.slice.lean.lean]}` : ''}.{' '}
                {-w.slice.gap > w.slice.margin ? 'Bigger than chance.' : `A lead so far, on ${w.slice.attempts} putts.`}
              </span>
              <button className="focus-drill fix" onClick={() => onRoll(w.fix)}>
                <span>
                  <strong>{w.fix.name}</strong>
                </span>
                <span className="small muted num">{lastOf(w.fix.id) ?? 'Fix it'}</span>
              </button>
              {w.track && <span className="small why-track">{w.track}</span>}
            </div>
          ))}
        </div>
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
      </div>
      </>
      )}
    </div>
  );
}

/**
 * The plain numbers under the strokes gained. Short putts are judged on holing them, long ones
 * on where they finish, so each zone gets the stats that fit it.
 */
export function ZoneStats({ z }: { z: ZoneRead }) {
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
  const cells = isLagZone(z.zone)
    ? [
        { v: z.leave !== null ? `${z.leave.toFixed(1)} ft` : '', k: 'Average leave' },
        { v: `${z.threePutts} of ${z.firstPutts}`, k: 'Three-putts' },
        { v: signed(z.sgPerPutt), k: 'Per putt' },
      ]
    : [
        { v: `${pct(z.makes, z.attempts)}%`, k: `Holed, ${z.makes} of ${z.attempts}` },
        { v: `${pct(z.scratchMakes, z.attempts)}%`, k: 'Scratch holes' },
        { v: signed(z.sgPerPutt), k: 'Per putt' },
      ];
  return (
    <div className="zone-stats">
      {cells
        .filter((c) => c.v)
        .map((c) => (
          <div key={c.k}>
            <strong className="num">{c.v}</strong>
            <span>{c.k}</span>
          </div>
        ))}
    </div>
  );
}

interface WhyItem {
  slice: Slice;
  fix: Fitted;
  track: string | null;
}

const DIR_MEANS: Record<MissDir, string> = {
  left: 'That is start line, not the read.',
  right: 'That is start line, not the read.',
  short: 'Short never goes in.',
  long: 'Long is where the comebackers come from.',
};

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
  const { state, dispatch, surface, room, putterId, scoped, family, drills } = usePractice();
  const [rolling, setRolling] = useState<Fitted | null>(null);
  // A tap shows what the drill is; only Start opens the counter.
  const [preview, setPreview] = useState<Fitted | null>(null);
  const [picked, setPicked] = useState<Zone | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  // Anywhere from nine to eighteen: short enough to fit a session, long enough to mean something.
  const [holeCount, setHoleCount] = useState(9);
  const now = useNow(!!state.run, 1000);

  const focus = useMemo(() => focusOf(state.rounds, state.baseline, putterId), [state.rounds, state.baseline, putterId]);
  const zone = focus.zones.find((z) => z.zone === (picked ?? focus.worst)) ?? null;
  const sets = state.practice;
  const list = histories(sets, family);
  const totals = totalsOf(sets);
  const live = liveRound(state);
  const startRound = (holeCount: number) => {
    if (!putterId) return;
    const round = makeRound({ date: today(), putterId, holeCount });
    dispatch({ t: 'newRound', round: { ...round, label: 'Practice round', practice: { surface } } });
    go('/track');
  };

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

  // The slow loop: inside the zone on the card, which kind of putt is behind it, and how that
  // kind has gone on the course since you started on its fix.
  const why: WhyItem[] = zone
    ? pinpoint(scoped.rounds, state.baseline, zone.zone).map((slice) => {
        const fixId = fixFor(slice.cond, slice.lean?.lean ?? null, slice.d, surface);
        const fix = fitToRoom(fixDrill(fixId)!, room);
        const started = sets.filter((x) => x.drill === fixId).map((x) => x.date).sort()[0];
        let track: string | null = null;
        if (started) {
          const t = sliceSince(scoped.rounds, zone.zone, slice.cond, started);
          const pct = (x: { made: number; attempts: number }) => Math.round((x.made / x.attempts) * 100);
          track =
            t.after.attempts >= SLICE_NEED && t.before.attempts
              ? `On the course since you started it on ${fmtDate(started)}: ${pct(t.after)}% of ${t.after.attempts}, against ${pct(t.before)}% before.`
              : `Started on ${fmtDate(started)}. ${t.after.attempts} of these putts on the course since, short of the ${SLICE_NEED} it takes to compare.`;
        }
        return { slice, fix, track };
      })
    : [];
  // The fast loop: your own practice misses, no round needed.
  const pattern = practicePattern(sets);
  const patternFix = pattern ? fitToRoom(fixDrill(practiceFix(pattern))!, room) : null;

  const runSession = state.run ? state.sessions.find((x) => x.id === state.run!.session) : undefined;
  // Sessions you have rolled lately first, then the rest in the order they came in.
  const lastRolled = new Map<string, string>();
  for (const x of sets) if (x.session && (lastRolled.get(x.session) ?? '') < x.date) lastRolled.set(x.session, x.date);
  const recentSessions = [...state.sessions].sort((a, b) => (lastRolled.get(b.id) ?? '').localeCompare(lastRolled.get(a.id) ?? ''));


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

      {pattern && patternFix && (
        <>
          <h2>From your practice</h2>
          <div className="card focus-card lose">
            <div className="focus-head">
              <h3>
                {pattern.band}, {SURFACE_LABELS[pattern.surface].toLowerCase()}
              </h3>
            </div>
            <p className="small focus-lean">
              {pattern.n} of your last {pattern.of} tagged misses went {pattern.dir}. {DIR_MEANS[pattern.dir]}
            </p>
            <div className="focus-drills">
              <button className="focus-drill" onClick={() => setPreview(patternFix)}>
                <span>
                  <strong>{patternFix.name}</strong>
                </span>
                <span className="small muted num">{lastOf(patternFix.id) ?? 'Fix it'}</span>
              </button>
            </div>
          </div>
        </>
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
            drills={drillsNear(drills, zone.zone, zone.lean?.lean ?? null, surface, room)}
            toWorst={focus.worst && focus.worst !== zone.zone ? () => setPicked(focus.worst) : undefined}
            why={why}
            surface={surface}
            lastOf={lastOf}
            onRoll={setPreview}
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

      <h2>Practice round</h2>
      {live && !live.practice ? (
        <p className="small muted">Finish or discard the round you are logging first.</p>
      ) : live ? (
        <a className="btn btn-primary btn-wide" href="#/track">
          Back to your practice round
        </a>
      ) : (
        <>
          <p className="small muted" style={{ margin: '0 0 8px' }}>
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
            <button className="btn btn-primary" disabled={!putterId} onClick={() => startRound(holeCount)}>
              Start
            </button>
          </div>
        </>
      )}

      <div className="row-list" style={{ marginTop: 18 }}>
        <a className="nav-row" href="#/practice/drills">
          <span className="nav-main">
            <strong>Browse every drill</strong>
            <span className="small muted">BREAK!'s, imported, and yours, or build one</span>
          </span>
          <Chevron />
        </a>
        {(sets.length > 0 || (state.practiceRounds ?? []).some((r) => r.finished)) && (
          <a className="nav-row" href="#/stats/practice">
            <span className="nav-main">
              <strong>Practice stats</strong>
              <span className="small muted">
                {totals.sets} {totals.sets === 1 ? 'set' : 'sets'}, {totals.putts} putts · your drills, rounds and
                practice against play
              </span>
            </span>
            <Chevron />
          </a>
        )}
      </div>

      {roomOpen && <RoomSheet onClose={() => setRoomOpen(false)} />}
      {preview && (
        <DrillPreview
          drill={preview}
          onClose={() => setPreview(null)}
          onStart={() => {
            setRolling(preview);
            setPreview(null);
          }}
        />
      )}
      {rolling && <DrillLogger key={rolling.id} drill={rolling} surface={surface} onClose={() => setRolling(null)} />}
    </div>
  );
}
