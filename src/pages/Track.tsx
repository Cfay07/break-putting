import { useState } from 'react';
import { HoleScore, fmtVsPar } from '../components/HoleScore';
import { ConfirmButton } from '../components/ConfirmButton';
import { CoursePicker, type CourseChoice } from '../components/CoursePicker';
import { Keypad } from '../components/Keypad';
import { Seg } from '../components/Seg';
import { Sheet } from '../components/Sheet';
import { go } from '../lib/router';
import { liveRound, useApp } from '../lib/store';
import {
  BREAK_DIRS,
  FACTORS,
  FACTOR_LABELS,
  holeVsPar,
  type BreakDir,
  type Factor,
  type MissSide,
  type Round,
  type Speed,
} from '../lib/types';

const MISS_SIDES: MissSide[] = ['high', 'low', 'online'];
const MISS_LABELS = { high: 'High', low: 'Low', online: 'On line' };
const SPEEDS: Speed[] = ['short', 'good', 'long'];
const SPEED_LABELS = { short: 'Short', good: 'Good', long: 'Long' };
const BREAK_LABELS: Record<BreakDir, string> = {
  'L→R': 'L→R',
  'R→L': 'R→L',
  straight: 'Straight',
  uphill: 'Uphill',
  downhill: 'Downhill',
};

function nextUnplayed(round: Round, from: number): number {
  for (let h = from + 1; h <= round.holeCount; h++) {
    if (!round.holes.find((x) => x.hole === h)?.putts.some((p) => p.made)) return h;
  }
  for (let h = 1; h <= round.holeCount; h++) {
    if (!round.holes.find((x) => x.hole === h)?.putts.some((p) => p.made)) return h;
  }
  return from;
}

export function Track() {
  const { state, dispatch } = useApp();
  const round = liveRound(state);
  const [finishing, setFinishing] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [choice, setChoice] = useState<CourseChoice>({ name: '' });
  const [score, setScore] = useState('');

  if (!round) {
    return (
      <div className="empty">
        <p>No round in progress.</p>
        <button className="btn btn-primary" onClick={() => go('/')}>
          Go start one
        </button>
      </div>
    );
  }

  const { track } = state;
  const hole = round.holes.find((h) => h.hole === track.hole) ?? { hole: track.hole, putts: [] };
  const complete = hole.putts.length > 0 && hole.putts[hole.putts.length - 1].made;
  const roundComplete = round.holes.every((h) => h.putts.some((p) => p.made));
  const scored = round.holes.filter((h) => holeVsPar(h) !== undefined);
  const runningScore = scored.reduce((sum, h) => sum + (holeVsPar(h) ?? 0), 0);
  const totalStrokes = round.holes.reduce((sum, h) => sum + (h.strokes ?? 0), 0);
  const d = Number(track.distanceInput);
  const canSubmit = track.distanceInput !== '' && d >= 1;
  const draft = track.draft ?? {};
  const hasPars = round.holes.some((h) => h.par !== undefined);

  const setDraft = (patch: Record<string, unknown>) =>
    dispatch({ t: 'setTrack', patch: { draft: { ...draft, ...patch } } });

  const finish = () => {
    dispatch({
      t: 'updateRound',
      id: round.id,
      patch: { score: score ? Number(score) : totalStrokes || undefined },
    });
    dispatch({ t: 'finishRound' });
    setFinishing(false);
    setScore('');
    go(`/round/${round.id}`);
  };

  return (
    <>
      <div className="track-bar">
        <div className="track-head">
          <span className="where">
            Hole {track.hole} ·{' '}
            {complete
              ? `${hole.putts.length} ${hole.putts.length === 1 ? 'putt' : 'putts'}`
              : `putt ${hole.putts.length + 1}`}
            {hole.par ? <span className="par-note"> par {hole.par}</span> : null}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {scored.length > 0 && <span className="tag num">{fmtVsPar(runningScore)}</span>}
            <button className="btn btn-ghost" onClick={() => dispatch({ t: 'undoLast' })}>
              Undo
            </button>
          </span>
        </div>
        <div className="hole-strip">
          {round.holes.map((h) => {
            const done = h.putts.some((p) => p.made);
            const three = h.putts.length >= 3;
            const cls = [three ? 'three' : done ? 'done' : '', h.hole === track.hole ? 'now' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={h.hole}
                className={cls}
                aria-label={`hole ${h.hole}`}
                onClick={() =>
                  dispatch({
                    t: 'setTrack',
                    patch: { hole: h.hole, phase: 'distance', distanceInput: '', draft: null },
                  })
                }
              >
                {h.hole}
              </button>
            );
          })}
        </div>
      </div>

      {!hasPars && (
        <button
          className="btn btn-ghost btn-wide"
          style={{ marginBottom: 12 }}
          onClick={() => setCourseOpen(true)}
        >
          Add the course to fill in pars
        </button>
      )}

      {hole.putts.length > 0 && (
        <div className="putt-log" style={{ marginBottom: 14 }}>
          {hole.putts.map((p, i) => (
            <span key={i} className={p.made ? 'putt-pill made' : 'putt-pill'}>
              {p.d} ft{p.made ? ' in' : ''}
              <button
                aria-label={`remove putt ${i + 1}`}
                onClick={() =>
                  dispatch({ t: 'removePutt', roundId: round.id, hole: hole.hole, index: i })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {complete ? (
        <div className="card">
          <h3>
            Hole {hole.hole}: {hole.putts.length} {hole.putts.length === 1 ? 'putt' : 'putts'}
          </h3>
          <div style={{ marginTop: 10 }}>
            <HoleScore
              hole={hole}
              onChange={(patch) =>
                dispatch({ t: 'setHoleScore', roundId: round.id, hole: hole.hole, patch })
              }
            />
          </div>
          <div style={{ height: 14 }} />
          {roundComplete ? (
            <button className="btn btn-primary btn-wide" onClick={() => setFinishing(true)}>
              Finish round
            </button>
          ) : (
            <button
              className="btn btn-primary btn-wide"
              onClick={() =>
                dispatch({
                  t: 'setTrack',
                  patch: {
                    hole: nextUnplayed(round, hole.hole),
                    phase: 'distance',
                    distanceInput: '',
                    draft: null,
                  },
                })
              }
            >
              Next hole
            </button>
          )}
        </div>
      ) : track.phase === 'distance' ? (
        <>
          <div className="readout">
            <div className={track.distanceInput ? 'd num' : 'd num dim'}>
              {track.distanceInput || '--'}
            </div>
            <div className="unit">feet{hole.putts.length ? ' · leave' : ''}</div>
          </div>
          <Keypad
            value={track.distanceInput}
            onChange={(next) => dispatch({ t: 'setTrack', patch: { distanceInput: next } })}
          />
          <div className="btn-row">
            <button
              className="btn btn-primary"
              disabled={!canSubmit}
              onClick={() => dispatch({ t: 'addPutt', putt: { d, made: true } })}
            >
              MADE
            </button>
            <button
              className="btn btn-danger"
              disabled={!canSubmit}
              onClick={() =>
                dispatch({ t: 'setTrack', patch: { phase: 'tags', draft: { d, made: false } } })
              }
            >
              MISSED
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <span className="tiny">Missed from</span>
            <h3 style={{ fontSize: 22, marginTop: 2 }} className="num">
              {draft.d} ft
            </h3>
          </div>

          <div className="field-label">Miss side</div>
          <Seg
            options={MISS_SIDES}
            labels={MISS_LABELS}
            value={draft.missSide}
            onPick={(v) => setDraft({ missSide: v })}
          />

          <div className="field-label">Speed</div>
          <Seg
            options={SPEEDS}
            labels={SPEED_LABELS}
            value={draft.speed}
            onPick={(v) => setDraft({ speed: v })}
          />

          <div className="field-label">How it broke (optional)</div>
          <Seg
            quiet
            options={BREAK_DIRS}
            labels={BREAK_LABELS}
            value={draft.breakDir}
            onPick={(v) => setDraft({ breakDir: v })}
          />

          <div className="field-label">Factors</div>
          <div className="chips">
            {FACTORS.map((f: Factor) => (
              <button
                key={f}
                type="button"
                className={draft[f] ? 'chip chip-on' : 'chip'}
                aria-pressed={!!draft[f]}
                onClick={() => setDraft({ [f]: !draft[f] })}
              >
                {FACTOR_LABELS[f]}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary btn-wide"
            style={{ marginTop: 18 }}
            onClick={() => dispatch({ t: 'addPutt', putt: { ...draft, d: draft.d!, made: false } })}
          >
            Next putt
          </button>
          <button
            className="btn btn-ghost btn-wide"
            style={{ marginTop: 8 }}
            onClick={() =>
              dispatch({
                t: 'setTrack',
                patch: { phase: 'distance', distanceInput: '', draft: null },
              })
            }
          >
            Back to distance
          </button>
        </>
      )}

      <div className="btn-row" style={{ marginTop: 26 }}>
        <button className="btn" onClick={() => setFinishing(true)}>
          Finish round
        </button>
        <ConfirmButton
          style={{ flex: '0 0 auto' }}
          label="Discard"
          confirmLabel="Tap again to discard"
          onConfirm={() => {
            dispatch({ t: 'deleteRound', id: round.id });
            go('/');
          }}
        />
      </div>

      {courseOpen && (
        <Sheet title="Course" onClose={() => setCourseOpen(false)}>
          <CoursePicker
            holeCount={round.holeCount}
            value={choice}
            onChange={(c) => {
              setChoice(c);
              if (!c.pars?.length) return;
              dispatch({
                t: 'applyCourse',
                roundId: round.id,
                course: c.name,
                courseId: c.courseId,
                tee: c.tee,
                pars:
                  round.holeCount === 9 && c.pars.length > 9 ? c.pars.slice(0, 9) : c.pars,
              });
              setCourseOpen(false);
            }}
          />
        </Sheet>
      )}

      {finishing && (
        <Sheet title="Finish round" onClose={() => setFinishing(false)}>
          <div className="field-label" style={{ marginTop: 0 }}>
            Score (optional)
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={score}
            placeholder={totalStrokes ? String(totalStrokes) : undefined}
            onChange={(e) => setScore(e.target.value)}
          />
          <p className="small muted">
            {totalStrokes
              ? `Your hole scores add up to ${totalStrokes}. Leave this blank to use that.`
              : 'Greens in regulation come from the hole scores, so there is nothing else to fill in.'}
          </p>
          <button className="btn btn-primary btn-wide" style={{ marginTop: 12 }} onClick={finish}>
            Save round
          </button>
        </Sheet>
      )}
    </>
  );
}
