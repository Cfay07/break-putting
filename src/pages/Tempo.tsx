import { useEffect, useRef, useState } from 'react';
import { BackLink } from '../components/BackLink';
import { useApp } from '../lib/store';
import { tuneArms, tuneVerdict, TUNE_MIN_BALLS } from '../lib/tempoTune';
import { today } from '../lib/format';
import { newId } from '../lib/storage';
import { usePractice } from '../lib/usePractice';
import { familyOf, METRONOME_ID } from '../lib/drills';
import type { PracticeSet } from '../lib/types';
import {
  beatTimes,
  canBuzz,
  FIND_START,
  FIND_STROKES,
  loadTempo,
  nextFind,
  saveTempo,
  startTempo,
  type Beat,
  type FindAnswer,
  type FindState,
  type TempoSettings,
} from '../lib/tempo';

const RATIOS = [1.5, 2, 2.5];
/** Strokes a set needs before it is worth asking how many went in. */
const MIN_LOG_STROKES = 3;
const BEAT_WORD: Record<Beat, string> = { start: 'Back', top: 'Top', impact: 'Hit' };

function Stepper({ value, label, onChange }: { value: string; label: string; onChange: (dir: -1 | 1) => void }) {
  return (
    <span className="mini-step">
      <button aria-label={`Less ${label}`} onClick={() => onChange(-1)}>
        −
      </button>
      <span className="num">{value}</span>
      <button aria-label={`More ${label}`} onClick={() => onChange(1)}>
        +
      </button>
    </span>
  );
}

function Toggle({ on, label, sub, onFlip }: { on: boolean; label: string; sub: string; onFlip: () => void }) {
  return (
    <div className="list-row">
      <span className="list-main">
        <span className="list-title">{label}</span>
        <span className="list-sub">{sub}</span>
      </span>
      <button type="button" role="switch" className="switch" aria-checked={on} aria-label={label} onClick={onFlip} />
    </div>
  );
}

/** Hold to stop, so a phone in a pocket cannot end the set by brushing the screen. */
function HoldToStop({ onStop }: { onStop: () => void }) {
  const timer = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const begin = () => {
    setHolding(true);
    timer.current = window.setTimeout(onStop, 900);
  };
  const cancel = () => {
    setHolding(false);
    if (timer.current) window.clearTimeout(timer.current);
  };
  return (
    <button
      className={holding ? 'tempo-stop holding' : 'tempo-stop'}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      Hold to stop
    </button>
  );
}

/** Five strokes at a speed, then how did it feel. A minute of this replaces guessing on the stepper. */
function Finder({
  base,
  onDone,
  onCancel,
}: {
  base: TempoSettings;
  onDone: (stroke: number) => void;
  onCancel: () => void;
}) {
  const [find, setFind] = useState<FindState>(() => ({ ...FIND_START }));
  const [asking, setAsking] = useState(false);
  const [stroke, setStroke] = useState(0);

  useEffect(() => {
    if (asking || find.done) return;
    let timer = 0;
    const stop = startTempo(
      { ...base, stroke: find.stroke, fade: false, every: find.stroke + 3, sound: base.sound || !base.buzz },
      (b, n) => {
        setStroke(n);
        if (b === 'impact' && n === FIND_STROKES - 1) timer = window.setTimeout(() => setAsking(true), 700);
      },
    );
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [asking, find, base]);

  const answer = (a: FindAnswer) => {
    setFind(nextFind(find, a));
    setAsking(false);
    setStroke(0);
  };

  if (find.done) {
    return (
      <div className="tempo-run">
        <span className="tempo-count">Your tempo</span>
        <span className="tempo-found num">{find.stroke.toFixed(2)} s</span>
        <p className="small muted tempo-run-note">
          The speed that felt right to you, {find.rounds} tries in. Make a few putts with it before you trust it.
        </p>
        <button className="btn btn-primary" style={{ minWidth: 220 }} onClick={() => onDone(find.stroke)}>
          Use {find.stroke.toFixed(2)} s
        </button>
        <button className="linkish small muted" onClick={onCancel}>
          Keep my old one
        </button>
      </div>
    );
  }

  return (
    <div className="tempo-run">
      <span className="tempo-count num">
        Try {find.rounds + 1} · {find.stroke.toFixed(2)} s
      </span>
      {asking ? (
        <>
          <span className="tempo-beat">How did that feel?</span>
          <div className="find-answers">
            <button onClick={() => answer('fast')}>Too fast</button>
            <button className="right" onClick={() => answer('right')}>
              Right
            </button>
            <button onClick={() => answer('slow')}>Too slow</button>
          </div>
        </>
      ) : (
        <>
          <span className="tempo-beat">
            Stroke {Math.min(stroke + 1, FIND_STROKES)} of {FIND_STROKES}
          </span>
          <p className="small muted tempo-run-note">Putt to the beat like you normally would.</p>
        </>
      )}
      <button className="linkish small muted" onClick={onCancel}>
        Stop
      </button>
    </div>
  );
}

/** What the blind tempo sets have said so far, in plain counts. */
function Tuned({ center }: { center: number }) {
  const { state } = useApp();
  const arms = tuneArms(state.practice, center, (id) => familyOf(state, id));
  if (!arms.some((a) => a.attempts)) return null;
  const v = tuneVerdict(arms);
  const short = arms.filter((a) => a.attempts < TUNE_MIN_BALLS).length;
  return (
    <>
      <h2>Tuned by your results</h2>
      <div className="list">
        {arms.map((a) => (
          <div key={a.stroke} className="list-row">
            <span className="list-main">
              <span className="list-title">
                {a.stroke.toFixed(2)} s{Math.abs(a.stroke - center) < 0.03 ? ' · yours' : ''}
              </span>
              <span className="list-sub">
                {a.attempts ? `${a.made} of ${a.attempts} inside 3 ft` : 'Not played yet'}
              </span>
            </span>
            <span className="list-sub num">{a.attempts ? `${Math.round((a.made / a.attempts) * 100)}%` : ''}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        {v.winner !== null
          ? `${v.winner.toFixed(2)} s is clearly best so far.`
          : short
            ? `The Same time, every length drill plays these blind. ${short === arms.length ? 'Each speed needs' : 'Some speeds need'} ${TUNE_MIN_BALLS} balls before any can win.`
            : 'Too close to call. Your tempo stays where it is until one speed pulls clear.'}
      </p>
    </>
  );
}

export function Tempo() {
  const { dispatch, surface, putterId } = usePractice();
  const [t, setT] = useState<TempoSettings>(loadTempo);
  const [running, setRunning] = useState(false);
  const [finding, setFinding] = useState(false);
  const [more, setMore] = useState(false);
  const [beat, setBeat] = useState<{ beat: Beat; stroke: number; silent: boolean } | null>(null);
  const strokesRef = useRef(0);
  /** After a set: how many strokes it ran, and how many went in, before it is saved or skipped. */
  const [done, setDone] = useState<{ strokes: number; made: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const buzzable = canBuzz();
  const update = (patch: Partial<TempoSettings>) => {
    const next = { ...t, ...patch };
    setT(next);
    saveTempo(next);
  };

  useEffect(() => {
    if (!running) return;
    strokesRef.current = 0;
    const stop = startTempo(t, (b, stroke, silent) => {
      strokesRef.current = stroke + 1;
      setBeat({ beat: b, stroke, silent });
    });
    // Keep the screen awake: a locked phone pauses the sound.
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      stop();
      void lock?.release();
      setBeat(null);
    };
  }, [running, t]);

  const stopRun = () => {
    setRunning(false);
    const strokes = strokesRef.current;
    setSaved(false);
    setDone(strokes >= MIN_LOG_STROKES ? { strokes, made: 0 } : null);
  };

  const logSet = () => {
    if (!done) return;
    const set: PracticeSet = {
      id: newId(),
      date: today(),
      drill: METRONOME_ID,
      surface,
      putterId,
      made: done.made,
      attempts: done.strokes,
      tempo: t.stroke,
      updated: new Date().toISOString(),
    };
    dispatch({ t: 'addPracticeSet', set });
    setDone(null);
    setSaved(true);
  };

  const [, back, through] = beatTimes(t);

  if (finding) {
    return (
      <Finder
        base={t}
        onDone={(stroke) => {
          update({ stroke });
          setFinding(false);
        }}
        onCancel={() => setFinding(false)}
      />
    );
  }

  if (running) {
    return (
      <div className="tempo-run">
        <span className="tempo-count num">Stroke {beat ? beat.stroke + 1 : 1}</span>
        <i className={beat && !beat.silent ? `tempo-dot on ${beat.beat}` : 'tempo-dot'} aria-hidden="true" />
        <span className="tempo-beat">
          {beat ? (beat.silent ? 'Silent. Keep the rhythm.' : BEAT_WORD[beat.beat]) : 'Get set'}
        </span>
        <p className="small muted tempo-run-note">
          {t.stroke.toFixed(2)} s · {t.ratio} to 1 · every {t.every} s. Taps do nothing until you hold the button.
        </p>
        <HoldToStop onStop={stopRun} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-top">
        <BackLink />
      </div>
      <h1 className="page-title">Metronome</h1>

      <div className="card tempo-main">
        <span className="tempo-k">Your tempo</span>
        <div className="tempo-big">
          <button
            aria-label="Quicker stroke"
            onClick={() => update({ stroke: Math.round(Math.max(0.6, t.stroke - 0.05) * 100) / 100 })}
          >
            −
          </button>
          <strong className="num">{t.stroke.toFixed(2)} s</strong>
          <button
            aria-label="Slower stroke"
            onClick={() => update({ stroke: Math.round(Math.min(1.6, t.stroke + 0.05) * 100) / 100 })}
          >
            +
          </button>
        </div>
        <span className="tempo-sub">
          Back {back.toFixed(2)} s, through {(through - back).toFixed(2)} s. Same time at every length.
        </span>
        <button
          className="btn btn-primary btn-wide"
          style={{ marginTop: 14 }}
          disabled={!t.sound && !t.buzz}
          onClick={() => setRunning(true)}
        >
          {!t.sound && !t.buzz ? 'Turn on sound or buzz' : 'Start'}
        </button>
        <button className="linkish small" style={{ marginTop: 10 }} onClick={() => setFinding(true)}>
          Not sure? Find my tempo ›
        </button>
      </div>

      {done && (
        <div className="card tempo-log">
          <span className="tempo-k">That set</span>
          <p className="tempo-log-q">
            {done.strokes} strokes at {t.stroke.toFixed(2)} s. How many went in?
          </p>
          <Stepper
            value={`${done.made} of ${done.strokes}`}
            label="putts in"
            onChange={(d) => setDone({ ...done, made: Math.min(done.strokes, Math.max(0, done.made + d)) })}
          />
          <div className="tempo-log-btns">
            <button className="btn btn-ghost" onClick={() => setDone(null)}>
              Skip
            </button>
            <button className="btn btn-primary" onClick={logSet}>
              Save to stats
            </button>
          </div>
        </div>
      )}
      {saved && <p className="replay-saved">Saved. It's in your practice log and stats, with your tempo.</p>}

      <button className="nav-row tempo-more" onClick={() => setMore(!more)} aria-expanded={more}>
        <span className="nav-main">
          <strong>More options</strong>
          <span className="small muted">Rhythm, time between putts, sound, buzz, fade out</span>
        </span>
        <span className="chev">{more ? '⌃' : '›'}</span>
      </button>

      {more && (
        <>
          <div className="list">
            <div className="list-row">
              <span className="list-main">
                <span className="list-title">Back to through</span>
                <span className="list-sub">How much longer the backstroke takes</span>
              </span>
              <div className="seg seg-quiet tempo-ratio" role="group" aria-label="Back to through">
                {RATIOS.map((r) => (
                  <button key={r} aria-pressed={t.ratio === r} onClick={() => update({ ratio: r })}>
                    {r}:1
                  </button>
                ))}
              </div>
            </div>
            <div className="list-row">
              <span className="list-main">
                <span className="list-title">Time between putts</span>
                <span className="list-sub">Room to set up the next ball</span>
              </span>
              <Stepper
                value={`${t.every} s`}
                label="time between putts"
                onChange={(d) => update({ every: Math.min(15, Math.max(3, t.every + d)) })}
              />
            </div>
            <Toggle
              on={t.sound}
              label="Sound"
              sub="A soft tick. Headphones are best."
              onFlip={() => update({ sound: !t.sound })}
            />
            {buzzable && (
              <Toggle
                on={t.buzz}
                label="Buzz"
                sub="The phone buzzes each beat. Turn sound off and it works from your pocket."
                onFlip={() => update({ buzz: !t.buzz })}
              />
            )}
            <Toggle
              on={t.fade}
              label="Fade out"
              sub="Every third stroke is silent, so the rhythm has to come from you."
              onFlip={() => update({ fade: !t.fade })}
            />
          </div>
          <Tuned center={t.stroke} />
        </>
      )}
    </div>
  );
}
