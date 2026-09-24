import { useState } from 'react';
import { HoleScore, fmtVsPar } from '../components/HoleScore';
import { ConfirmButton } from '../components/ConfirmButton';
import { CoursePicker, type CourseChoice } from '../components/CoursePicker';
import { Keypad } from '../components/Keypad';
import { Seg } from '../components/Seg';
import { SegMulti } from '../components/SegMulti';
import { Sheet } from '../components/Sheet';
import { go } from '../lib/router';
import { liveBleed } from '../lib/bleed';
import { liveRound, useApp } from '../lib/store';
import { syncQuietly } from '../lib/sync';
import {
  BREAK_DIRS,
  BREAK_LABELS,
  breakLabel,
  toggleBreak,
  FACTORS,
  FACTOR_LABELS,
  holeVsPar,
  holedOut,
  type Factor,
  type MissSide,
  type Round,
  type Speed,
} from '../lib/types';

const MISS_SIDES: MissSide[] = ['high', 'low', 'online'];
const MISS_LABELS = { high: 'High', low: 'Low', online: 'On line' };
/** Below this a made putt is a tap-in, and asking which way it broke is just friction. */
const BREAK_PROMPT_FROM = 4;

const SPEEDS: Speed[] = ['short', 'good', 'long'];
const SPEED_LABELS = { short: 'Short', good: 'Good', long: 'Long' };

function played(round: Round, hole: number): boolean {
  const h = round.holes.find((x) => x.hole === hole);
  return !!h && (holedOut(h) || h.putts.some((p) => p.made));
}

function nextUnplayed(round: Round, from: number): number {
  for (let h = from + 1; h <= round.holeCount; h++) if (!played(round, h)) return h;
  for (let h = 1; h <= round.holeCount; h++) if (!played(round, h)) return h;
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
  const complete =
    holedOut(hole) || (hole.putts.length > 0 && hole.putts[hole.putts.length - 1].made);
  const roundComplete = round.holes.every((h) => holedOut(h) || h.putts.some((p) => p.made));
  const scored = round.holes.filter((h) => holeVsPar(h) !== undefined);
  const runningScore = scored.reduce((sum, h) => sum + (holeVsPar(h) ?? 0), 0);
  const totalStrokes = round.holes.reduce((sum, h) => sum + (h.strokes ?? 0), 0);
  const bleed = liveBleed(round);
  const quiet = state.quietTrack ?? false;
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
    void syncQuietly(state, dispatch);
  };

  return (
    <>
      <div className="track-bar">
        <div className="track-head">
          <span className="where">
            Hole {track.hole} ·{' '}
            {holedOut(hole)
              ? 'chipped in'
              : complete
                ? `${hole.putts.length} ${hole.putts.length === 1 ? 'putt' : 'putts'}`
                : `putt ${hole.putts.length + 1}`}
            {hole.par ? <span className="par-note"> par {hole.par}</span> : null}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!quiet && scored.length > 0 && (
              <span className="tag num">{fmtVsPar(runningScore)}</span>
            )}
            {!quiet && bleed.bleeding && (
              <span className="drop" aria-label={`bleeding ${bleed.holes} holes`}>
                🩸{bleed.holes > 0 ? bleed.holes : ''}
              </span>
            )}
            <button className="btn btn-ghost" onClick={() => dispatch({ t: 'undoLast' })}>
              Undo
            </button>
          </span>
        </div>
        <div className="hole-strip">
          {round.holes.map((h) => {
            const done = holedOut(h) || h.putts.some((p) => p.made);
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
              {p.d} ft{p.made ? ' holed' : ''}
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
            Hole {hole.hole}:{' '}
            {holedOut(hole)
              ? 'chipped in'
              : `${hole.putts.length} ${hole.putts.length === 1 ? 'putt' : 'putts'}`}
          </h3>
          <div style={{ marginTop: 10 }}>
            <HoleScore
              hole={hole}
              onChange={(patch) =>
                dispatch({ t: 'setHoleScore', roundId: round.id, hole: hole.hole, patch })
              }
            />
          </div>
          {!quiet && !bleed.bleeding && (holeVsPar(hole) ?? 1) <= 0 && (
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              Stopped the bleed.
            </p>
          )}
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
              onClick={() =>
                d >= BREAK_PROMPT_FROM
                  ? dispatch({ t: 'setTrack', patch: { phase: 'tags', draft: { d, made: true } } })
                  : dispatch({ t: 'addPutt', putt: { d, made: true } })
              }
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
          {hole.putts.length === 0 && (
            <button
              className="btn btn-ghost btn-wide"
              style={{ marginTop: 10 }}
              onClick={() =>
                dispatch({
                  t: 'setHoleScore',
                  roundId: round.id,
                  hole: hole.hole,
                  patch: { holedOut: true },
                })
              }
            >
              Chipped in, no putts
            </button>
          )}
        </>
      ) : (
        <>
          <div className="card">
            <span className="tiny">{draft.made ? 'Holed from' : 'Missed from'}</span>
            <h3 style={{ fontSize: 22, marginTop: 2 }} className="num">
              {draft.d} ft
            </h3>
          </div>

          {!draft.made && (
            <>
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
            </>
          )}

          <div className="field-label">
            How it broke (optional)
            {breakLabel(draft.breakDirs ?? []) ? (
              <span className="muted"> · {breakLabel(draft.breakDirs ?? [])}</span>
            ) : null}
          </div>
          <SegMulti
            quiet
            options={BREAK_DIRS}
            labels={BREAK_LABELS}
            values={draft.breakDirs ?? []}
            onToggle={(v) => setDraft({ breakDirs: toggleBreak(draft.breakDirs ?? [], v) })}
          />

          {!draft.made && <div className="field-label">Factors</div>}
          <div className="chips" style={draft.made ? { display: 'none' } : undefined}>
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
            onClick={() =>
              dispatch({ t: 'addPutt', putt: { ...draft, d: draft.d!, made: !!draft.made } })
            }
          >
            {draft.made ? 'Save putt' : 'Next putt'}
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
