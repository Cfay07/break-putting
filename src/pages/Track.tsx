import { useMemo, useState } from 'react';
import { HoleScore, fmtVsPar } from '../components/HoleScore';
import { ConfirmButton } from '../components/ConfirmButton';
import { CoursePicker, type CourseChoice } from '../components/CoursePicker';
import { Keypad } from '../components/Keypad';
import { MissGrid } from '../components/MissGrid';
import { CupEntry } from '../components/CupEntry';
import { SegMulti } from '../components/SegMulti';
import { ReadBreak } from '../components/ReadBreak';
import { Sheet } from '../components/Sheet';
import { go } from '../lib/router';
import { bleedMarks, liveBleed } from '../lib/bleed';
import { fitMakeModel } from '../lib/makeability';
import { makeChanceOf, xpOf } from '../lib/xp';
import { liveRound, useApp } from '../lib/store';
import { syncQuietly } from '../lib/sync';
import {
  BREAK_DIRS,
  BREAK_LABELS,
  breakLabel,
  toggleBreak,
  FACTORS,
  slopeOf,
  SLOPE_LABELS,
  SLOPE_STEPS,
  type Putt,
  FACTOR_LABELS,
  holeVsPar,
  holedOut,
  type Factor,
  type Round,
} from '../lib/types';

/** Below this a made putt is a tap-in, and asking which way it broke is just friction. */
const BREAK_PROMPT_FROM = 4;


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
  // Above every early return. This used to sit beside the draft readout, below the branch for
  // "no live round", so finishing a round dropped a hook between renders and React threw. With no
  // boundary at the time that was a white screen on the last tap of a round.
  const makeModel = useMemo(() => fitMakeModel(state.rounds), [state.rounds]);
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
  const holesPlayed = round.holes.filter((h) => h.putts.length > 0 || holedOut(h)).length;
  // Every per-round number is quoted on an eighteen-hole footing, so a short round is multiplied
  // up. Nine keeps that at double; one hole was being counted eighteen times.
  const MIN_FINISH = 9;
  const canFinish = holesPlayed >= MIN_FINISH;
  const shortBy = MIN_FINISH - holesPlayed;
  const scored = round.holes.filter((h) => holeVsPar(h) !== undefined);
  const runningScore = scored.reduce((sum, h) => sum + (holeVsPar(h) ?? 0), 0);
  const totalStrokes = round.holes.reduce((sum, h) => sum + (h.strokes ?? 0), 0);
  const bleed = liveBleed(round);
  // "Stopped the bleed" used to fire on any par with no bleed running, including hole one. It
  // only means something if the hole before it was actually a trigger or part of a bleed.
  const marks = bleedMarks(round);
  const prevPlayed = round.holes
    .filter((h) => h.hole < hole.hole && (h.putts.length > 0 || holedOut(h)))
    .pop();
  const bouncedBack =
    !!prevPlayed &&
    (marks.triggers.has(prevPlayed.hole) || marks.bled.has(prevPlayed.hole)) &&
    (holeVsPar(hole) ?? 1) <= 0;
  // Competitive rounds hide the score and the bleed drop without anyone remembering a setting.
  const quiet = (state.quietTrack ?? false) || !!round.competitive;
  const d = Number(track.distanceInput);
  const canSubmit = track.distanceInput !== '' && d >= 1;
  const draft = track.draft ?? {};
  const draftPutt = draft.d ? ({ ...draft, d: draft.d, made: !!draft.made } as Putt) : null;
  const draftXp = draftPutt ? xpOf(makeModel, state.baseline, draftPutt) : null;
  const draftChance = draftPutt ? makeChanceOf(makeModel, draftPutt) : null;
  // A toe or heel strike is a fault, so it can never sit beside "Nothing wrong".
  const offCentre = draft.strike === 'toe' || draft.strike === 'heel';
  const cleanCalled = !!draft.executionAssessed && !FACTORS.some((f: Factor) => draft[f]) && !offCentre;
  const hasPars = round.holes.some((h) => h.par !== undefined);
  // A practice round is only putts: no course, no par, no score on the hole.
  const practice = !!round.practice;

  const setDraft = (patch: Record<string, unknown>) =>
    dispatch({ t: 'setTrack', patch: { draft: { ...draft, ...patch } } });

  const finish = () => {
    if (practice) {
      dispatch({ t: 'finishRound' });
      go(`/round/${round.id}`);
      void syncQuietly(state, dispatch);
      return;
    }
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

      {!hasPars && !practice && (
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
          {!practice && (
            <div style={{ marginTop: 10 }}>
              <HoleScore
                hole={hole}
                onChange={(patch) =>
                  dispatch({ t: 'setHoleScore', roundId: round.id, hole: hole.hole, patch })
                }
              />
            </div>
          )}
          {!quiet && bouncedBack && (
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              Bounced back. Bleeding stopped.
            </p>
          )}
          <div style={{ height: 14 }} />
          {roundComplete ? (
            <button
              className="btn btn-primary btn-wide"
              disabled={!canFinish}
              onClick={() => (practice ? finish() : setFinishing(true))}
            >
              {practice ? 'Finish practice round' : 'Finish round'}
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
          {hole.putts.length === 0 && !practice && (
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

          {draft.made && (
            <>
              <div className="field-label">Where it went in</div>
              <CupEntry value={draft.cupEntry} onPick={(cupEntry) => setDraft({ cupEntry })} />
            </>
          )}

          {!draft.made && (
            <>
              <div className="field-label">Where it finished</div>
              <MissGrid
                side={draft.missSide}
                speed={draft.speed}
                onPick={(missSide, speed) => {
                  const wasLipCell = draft.missSide === 'online' && draft.speed === 'good';
                  const isLipCell = missSide === 'online' && speed === 'good';
                  setDraft({
                    missSide,
                    speed,
                    ...(isLipCell ? { lip: true } : wasLipCell ? { lip: false } : {}),
                  });
                }}
              />
            </>
          )}

          <div className="field-label">
            How it broke
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

          {slopeOf(draft.breakDirs ?? []) && (
            <>
              <div className="field-label">
                {slopeOf(draft.breakDirs ?? []) === 'uphill' ? 'Uphill' : 'Downhill'}, how much
              </div>
              <div className="chips chips-sm">
                {SLOPE_STEPS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={draft.slopeAs === n ? 'chip chip-on' : 'chip'}
                    aria-pressed={draft.slopeAs === n}
                    onClick={() => setDraft({ slopeAs: draft.slopeAs === n ? undefined : n })}
                  >
                    {SLOPE_LABELS[n]}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Only on a putt that actually turned. There is no read to be wrong about on a
              straight one. */}
          {(draft.breakDirs ?? []).some((d) => d === 'L→R' || d === 'R→L' || d === 'straight') && (
            <>
              <div className="field-label">The read</div>
              <ReadBreak
                dirs={draft.breakDirs ?? []}
                readAs={draft.readAs}
                brokeAs={draft.brokeAs}
                wrongWay={!!draft.wrongWay}
                onPick={(readAs, brokeAs, wrongWay) =>
                  setDraft({ readAs, brokeAs, wrongWay: wrongWay || undefined })
                }
              />
            </>
          )}

          <div className="field-label">Strike</div>
          <div className="chips">
            {(['toe', 'centre', 'heel'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={draft.strike === k ? 'chip chip-on' : 'chip'}
                aria-pressed={draft.strike === k}
                onClick={() =>
                  setDraft({ strike: draft.strike === k ? undefined : k, executionAssessed: true })
                }
              >
                {k === 'centre' ? 'Middle' : k === 'toe' ? 'Toe' : 'Heel'}
              </button>
            ))}
          </div>

          <div className="field-label">Factors</div>
          <div className="chips">
            {/* Without this an empty set means both "nothing was wrong" and "nobody looked". */}
            <button
              type="button"
              className={cleanCalled ? 'chip chip-on' : 'chip'}
              aria-pressed={cleanCalled}
              onClick={() =>
                setDraft(
                  cleanCalled
                    ? { executionAssessed: undefined }
                    : {
                        ...Object.fromEntries(FACTORS.map((f: Factor) => [f, false])),
                        ...(offCentre ? { strike: undefined } : {}),
                        executionAssessed: true,
                      },
                )
              }
            >
              Nothing wrong
            </button>
            {/* One flow rather than two rows: a lone chip above five wraps as 1, 4, 1. Factors
                were also hidden on a holed putt, so a putt you pushed and holed anyway could not
                be recorded at all. Across 431 makes that produced exactly zero faulty ones, which
                left "has a fault" standing in for "missed" in anything that read it. */}
            {FACTORS.filter((f) => !(draft.made && f === 'lip')).map((f: Factor) => (
              <button
                key={f}
                type="button"
                className={draft[f] ? 'chip chip-on' : 'chip'}
                aria-pressed={!!draft[f]}
                onClick={() => setDraft({ [f]: !draft[f], executionAssessed: true })}
              >
                {FACTOR_LABELS[f]}
              </button>
            ))}
          </div>

          {/* What the putt you just described is worth, before it is filed. Hidden on a
              competitive round along with everything else behind `quiet`: live expected-value
              readouts mid-tournament are a rules question nobody needs. */}
          {!quiet && draftXp !== null && (
            <div className="draft-xp">
              <span className="dx-k">Expected putts (xP)</span>
              <span className="dx-v">{draftXp.toFixed(2)}</span>
              <span className="dx-k">Chance it drops</span>
              <span className="dx-v">
                {draftChance === null ? (
                  <span className="dx-note">Past your longest putt, {makeModel.longest} ft</span>
                ) : (
                  `${(draftChance * 100).toFixed(2)}%`
                )}
              </span>
            </div>
          )}

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

      {!canFinish && (
        <p className="small muted" style={{ margin: '20px 0 -14px' }}>
          {holesPlayed === 0
            ? 'Log a hole before finishing. Nine is the minimum a round can be saved at.'
            : `${holesPlayed} ${holesPlayed === 1 ? 'hole' : 'holes'} in. A round needs nine before it can be saved, because every stat is quoted per eighteen and a shorter round gets multiplied up. ${shortBy} to go, or discard it.`}
        </p>
      )}

      <div className="btn-row" style={{ marginTop: 26 }}>
        <button className="btn" disabled={!canFinish} onClick={() => (practice ? finish() : setFinishing(true))}>
          {practice ? 'Finish practice round' : 'Finish round'}
        </button>
        <ConfirmButton
          style={{ flex: '0 0 auto' }}
          label="Discard"
          confirmLabel="Tap again to discard"
          onConfirm={() => {
            dispatch({ t: 'deleteRound', id: round.id });
            go(practice ? '/practice' : '/');
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
