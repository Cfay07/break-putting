import { useState } from 'react';
import { HoleScore, fmtVsPar } from '../components/HoleScore';
import { ConfirmButton } from '../components/ConfirmButton';
import { CoursePicker, type CourseChoice } from '../components/CoursePicker';
import { Keypad } from '../components/Keypad';
import { MissGrid } from '../components/MissGrid';
import { SegMulti } from '../components/SegMulti';
import { ReadBreak } from '../components/ReadBreak';
import { StrokeTags } from '../components/StrokeTags';
import { Sheet } from '../components/Sheet';
import { go, replaceRoute } from '../lib/router';
import { bleedMarks, liveBleed } from '../lib/bleed';
import { ZONE_RANGE } from '../lib/pinpoint';
import { liveRound, useApp } from '../lib/store';
import { syncQuietly } from '../lib/sync';
import {
  BREAK_DIRS,
  BREAK_LABELS,
  breakLabel,
  breakStory,
  toggleBreak,
  slopeOf,
  SLOPE_LABELS,
  SLOPE_STEPS,
  holeVsPar,
  holedOut,
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
  const round = liveRound(state);
  const [finishing, setFinishing] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [choice, setChoice] = useState<CourseChoice>({ name: '' });
  const [score, setScore] = useState('');
  const [moreFor, setMoreFor] = useState<string | null>(null);

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
  const complete = holedOut(hole) || (hole.putts.length > 0 && hole.putts[hole.putts.length - 1].made);
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
  // Only the first par or better after a mistake, the same hole the scorecard ticks.
  const ended = bleedMarks(round).ended.has(hole.hole) && (holeVsPar(hole) ?? 1) <= 0;
  // Competitive rounds hide the score and the bleed drop without anyone remembering a setting.
  const quiet = (state.quietTrack ?? false) || !!round.competitive;
  const d = Number(track.distanceInput);
  const canSubmit = track.distanceInput !== '' && d >= 1;
  const draft = track.draft ?? {};
  // A putt from your target's distance is the one that answers whether practice is working.
  const [targetType, targetZone] = (state.target && !state.target.fixedOn ? state.target.key : '').split(':');
  const targetRange =
    targetType === 'slice' || targetType === 'zone' ? ZONE_RANGE[targetZone as keyof typeof ZONE_RANGE] : null;
  const onTarget =
    !!draft.d && !!targetRange && !round?.practice && draft.d >= targetRange[0] && draft.d <= targetRange[1];
  const hasPars = round.holes.some((h) => h.par !== undefined);
  // Quick logging keeps the tag screen to where a miss finished. A putt from your target's distance
  // still asks for everything, because that putt is the one the target is checked on.
  const inTarget = (ft: number) => !!targetRange && !round.practice && ft >= targetRange[0] && ft <= targetRange[1];
  const quick = !!state.quickTags && !onTarget;
  const puttKey = `${track.hole}:${hole.putts.length}`;
  const showMore = !quick || moreFor === puttKey;
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
            {!quiet && scored.length > 0 && <span className="tag num">{fmtVsPar(runningScore)}</span>}
            {!quiet && bleed.strokes > 0 && (
              <span className="drop" aria-label={`putting mistakes put ${bleed.strokes} on the card`}>
                🩸{bleed.strokes}
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
        <button className="btn btn-ghost btn-wide" style={{ marginBottom: 12 }} onClick={() => setCourseOpen(true)}>
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
                onClick={() => dispatch({ t: 'removePutt', roundId: round.id, hole: hole.hole, index: i })}
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
            {holedOut(hole) ? 'chipped in' : `${hole.putts.length} ${hole.putts.length === 1 ? 'putt' : 'putts'}`}
          </h3>
          {!practice && (
            <div style={{ marginTop: 10 }}>
              <HoleScore
                hole={hole}
                onChange={(patch) => dispatch({ t: 'setHoleScore', roundId: round.id, hole: hole.hole, patch })}
              />
            </div>
          )}
          {!quiet && ended && (
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              Bleeding stopped.
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
            <div className={track.distanceInput ? 'd num' : 'd num dim'}>{track.distanceInput || '--'}</div>
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
                d >= BREAK_PROMPT_FROM && (!state.quickTags || inTarget(d))
                  ? dispatch({ t: 'setTrack', patch: { phase: 'tags', draft: { d, made: true } } })
                  : dispatch({ t: 'addPutt', putt: { d, made: true } })
              }
            >
              MADE
            </button>
            <button
              className="btn btn-danger"
              disabled={!canSubmit}
              onClick={() => dispatch({ t: 'setTrack', patch: { phase: 'tags', draft: { d, made: false } } })}
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

          {onTarget && (
            <p className="target-flag">
              Your target distance. Tag how it broke{targetType === 'slice' ? ' and the read' : ''}, and this putt
              counts toward the check.
            </p>
          )}
          {!showMore && (
            <button
              type="button"
              className="btn btn-ghost btn-wide"
              style={{ marginTop: 12 }}
              onClick={() => setMoreFor(puttKey)}
            >
              More tags
            </button>
          )}
          {showMore && (
            <>
              <div className="field-label">
                How it broke
                {!breakStory(draft.breakDirs ?? []) && breakLabel(draft.breakDirs ?? []) ? (
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
              {breakStory(draft.breakDirs ?? []) && (
                <p className="small brk-story">{breakStory(draft.breakDirs ?? [])}</p>
              )}

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

              <StrokeTags putt={draft} onPatch={setDraft} />
            </>
          )}

          {/* Pinned above the tab bar: a fully tagged miss runs past the bottom of a phone, and
              scrolling to save every putt adds up over a round. */}
          <div className="tag-save">
            <button
              className="btn btn-primary btn-wide"
              onClick={() => dispatch({ t: 'addPutt', putt: { ...draft, d: draft.d!, made: !!draft.made } })}
            >
              {draft.made ? 'Save putt' : 'Next putt'}
            </button>
          </div>
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
            replaceRoute(practice ? '/practice' : '/');
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
                pars: round.holeCount === 9 && c.pars.length > 9 ? c.pars.slice(0, 9) : c.pars,
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
