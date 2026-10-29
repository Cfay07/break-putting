import { useMemo, useState } from 'react';
import { bleedMarks, bleedsIn } from '../lib/bleed';
import { lagSaves } from '../lib/stats';
import { expectedPutts, holeSG, puttSG } from '../lib/sg';
import { fitMakeModel } from '../lib/makeability';
import {
  holeAdjustments,
  makeChanceOf,
  puttSGAdjusted,
  roundSGAdjusted,
  verdictOf,
  VERDICT_LABEL,
  xpOf,
} from '../lib/xp';
import { drawRoundSheet, pngFile } from '../lib/shareCard';
import { publishRound, shareUrl } from '../lib/shareLink';
import { currentSession } from '../lib/cloud';
import { ConfirmButton } from '../components/ConfirmButton';
import { ScoreMark } from '../components/ScoreMark';
import { DistanceTable } from '../components/DistanceTable';
import { HoleScore, fmtVsPar } from '../components/HoleScore';
import { InsightList } from '../components/InsightList';
import { LagPanel } from '../components/LagPanel';
import { PatternPanel } from '../components/PatternPanel';
import { ReadPanel } from '../components/ReadPanel';
import { readError } from '../lib/readError';
import { formOf } from '../lib/form';
import { FormPanel } from '../components/FormPanel';
import { PutterTag } from '../components/PutterTag';
import { GreenSpeedPick } from '../components/GreenSpeedPick';
import { Conditions } from '../components/Conditions';
import { CoursePicker } from '../components/CoursePicker';
import { PuttEditor } from '../components/PuttEditor';
import { SpeedBars } from '../components/SpeedBars';
import { Sheet } from '../components/Sheet';
import { fmtDateLong, pctText, puttSequence, signed } from '../lib/format';
import { go } from '../lib/router';
import { pct, roundStats, suspectHoles } from '../lib/stats';
import { useApp } from '../lib/store';
import { breakDirsOf, breakLabel, holeVsPar, holedOut } from '../lib/types';


/**
 * Putting strokes gained on one hole. Half a shot is the line where a hole stops being a bad
 * break and starts being the reason the round went: those get the weight so the eye finds them
 * without reading every number.
 */
const FAULT_WORDS: [string, string][] = [
  ['push', 'push'],
  ['pull', 'pull'],
  ['decel', 'quit on it'],
  ['accel', 'jabbed it'],
  ['wrongWay', 'read it the wrong way'],
];

function SgCell({ value }: { value: number | null }) {
  if (value === null) return <span className="sg" />;
  const cls =
    value <= -0.5 ? 'sg down big' : value < 0 ? 'sg down' : value > 0 ? 'sg up' : 'sg';
  return (
    <span className={cls}>
      {value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}
    </span>
  );
}

export function RoundDetail({ id }: { id: string }) {
  const { state, dispatch } = useApp();
  const round = state.rounds.find((r) => r.id === id);
  // Fitted on every round, not just this one: one round is nowhere near enough break to learn from.
  const makeModel = useMemo(() => fitMakeModel(state.rounds), [state.rounds]);
  const sgAdjusted = useMemo(
    () => (round ? roundSGAdjusted(makeModel, state.baseline, round.holes) : null),
    [makeModel, state.baseline, round],
  );
  const [editHole, setEditHole] = useState<number | null>(null);
  const [editPutt, setEditPutt] = useState<number | null>(null);
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [speedSheet, setSpeedSheet] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);

  if (!round) {
    return (
      <div className="empty">
        <p>That round is gone.</p>
        <button className="btn btn-primary" onClick={() => go('/')}>
          Back to rounds
        </button>
      </div>
    );
  }

  const s = roundStats(round, state.baseline);
  const scoringPct = pct(s.scoring);
  const mismatch = round.recordedPutts && round.recordedPutts !== s.totalPutts;
  const hole = editHole !== null ? round.holes.find((h) => h.hole === editHole) : undefined;

  const sgOf = (h: { putts: { d: number }[] }) =>
    h.putts.length ? holeSG(state.baseline, h.putts.map((p) => p.d), h.putts.length) : null;
  const read = readError([round]);
  const form = formOf(round, state.baseline);
  const marks = bleedMarks(round);
  const bleeds = bleedsIn(round);
  const suspect = suspectHoles(round);

  // The relative column runs as a total through the round, the way a leaderboard reads, since
  // par and score already sit side by side to show what each hole cost.
  const running = new Map<number, number>();
  let carried = 0;
  for (const h of round.holes) {
    const vs = holeVsPar(h);
    if (vs === undefined) continue;
    carried += vs;
    running.set(h.hole, carried);
  }

  return (
    <>
      <div style={{ marginBottom: 6 }}>
        <button className="linkish tiny" onClick={() => go('/')}>
          ← Rounds
        </button>
      </div>
      <div className="round-head">
        <h3 style={{ fontSize: 21 }}>{fmtDateLong(round.date)}</h3>
        <PutterTag putterId={round.putterId} />
      </div>
      {(round.course || round.firstNine) && (
        <p className="small muted" style={{ margin: '2px 0 0' }}>
          {[round.course, [round.firstNine, round.secondNine].filter(Boolean).join(' + ')]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      <div className="chips" style={{ marginTop: 8 }}>
        <button
          className="chip"
          disabled={sharing}
          onClick={() => {
            if (!currentSession()) {
              setShareNote('Sign in first so the link has somewhere to live.');
              return;
            }
            setSharing(true);
            setShareNote('Making a link…');
            const card = pngFile(
              drawRoundSheet({
                round,
                stats: s,
                baseline: state.baseline,
                putter: state.putters.find((p) => p.id === round.putterId)?.name,
              }),
              `break-${round.date}.png`,
            );
            void publishRound(round, state.baseline)
              .then(async (token) => {
                const url = shareUrl(token);
                const title = `${fmtDateLong(round.date)}${round.course ? ` · ${round.course}` : ''}`;
                // The picture is the hook, the link is the whole round. Send both where the
                // sheet takes them, and the link alone where it will not.
                const withCard = { title, text: title, url, files: [card] };
                if (navigator.canShare?.(withCard)) {
                  await navigator.share(withCard);
                } else if (navigator.canShare?.({ title, text: title, url })) {
                  await navigator.share({ title, text: title, url });
                } else {
                  await navigator.clipboard.writeText(url);
                  setShareNote('Link copied. Anyone with it sees the whole round.');
                  return;
                }
                setShareNote('');
              })
              .catch((e) => {
                const err = e as Error;
                setShareNote(err.name === 'AbortError' ? '' : err.message);
              })
              .finally(() => setSharing(false));
          }}
        >
          {sharing ? 'Sharing…' : 'Share'}
        </button>
        <button className="chip" onClick={() => setSpeedSheet(true)}>
          {round.greenSpeed ? <SpeedBars speed={round.greenSpeed} label /> : 'Set green speed'}
        </button>
        <button
          className={round.competitive ? 'chip chip-sel' : 'chip'}
          aria-pressed={!!round.competitive}
          onClick={() =>
            dispatch({ t: 'updateRound', id: round.id, patch: { competitive: !round.competitive } })
          }
        >
          {round.competitive ? 'Competitive' : 'Casual'}
        </button>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>
          Edit round
        </button>
        <ConfirmButton
          className="btn btn-ghost btn-danger"
          label="Delete"
          confirmLabel="Tap again to delete"
          onConfirm={() => {
            dispatch({ t: 'deleteRound', id: round.id });
            go('/');
          }}
        />
      </div>

      {speedSheet && (
        <Sheet title="Greens, by stimp" onClose={() => setSpeedSheet(false)}>
          <GreenSpeedPick
            value={round.greenSpeed}
            onPick={(greenSpeed) => {
              dispatch({ t: 'updateRound', id: round.id, patch: { greenSpeed } });
              setSpeedSheet(false);
            }}
          />
          <p className="small muted" style={{ marginTop: 10 }}>
            How the greens rolled that day. Stats can be split by this, so a fast-green round is
            not averaged in with a slow one.
          </p>

          <Conditions
            aerated={round.aerated}
            bumpy={round.bumpy}
            onChange={(patch) => dispatch({ t: 'updateRound', id: round.id, patch })}
          />
        </Sheet>
      )}

      {shareNote && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          {shareNote}
        </p>
      )}

      <h2>The numbers</h2>
      <div className="card">
        <div className="stat-row">
          <span className="k">Putts (tallied)</span>
          <span className="v num">{s.totalPutts}</span>
        </div>
        {mismatch && (
          <div className="stat-row">
            <span className="k">On the card</span>
            <span className="v num neg">{round.recordedPutts}</span>
          </div>
        )}
        <div className="stat-row">
          <span className="k">Putts per hole</span>
          <span className="v num">{s.puttsPerHole.toFixed(1)}</span>
        </div>
        <div className="stat-row">
          <span className="k">Strokes gained putting</span>
          <span className={s.sg >= 0 ? 'v num pos' : 'v num neg'}>{signed(s.sg)}</span>
        </div>
        {/* Only worth a row where the break model actually moves it. Condition-adjusted, never
            "corrected": it changes the verdict, which is not the same as having earned it. */}
        {sgAdjusted !== null && Math.abs(sgAdjusted - s.sg) >= 0.05 && (
          <div className="stat-row">
            <span className="k">
              With break and slope<span className="small muted"> · preliminary</span>
            </span>
            <span className={sgAdjusted >= 0 ? 'v num pos' : 'v num neg'}>{signed(sgAdjusted)}</span>
          </div>
        )}
        <div className="stat-row">
          <span className="k">1 / 2 / 3+ putts</span>
          <span className="v num">
            {s.onePutts} / {s.twoPutts} / <span className={s.threePlus ? 'neg' : ''}>{s.threePlus}</span>
          </span>
        </div>
        {s.threePuttHoles.length > 0 && (
          <div className="stat-row">
            <span className="k">Three-putt holes</span>
            <span className="v num neg">{s.threePuttHoles.map((h) => `#${h}`).join(', ')}</span>
          </div>
        )}
        <div className="stat-row">
          <span className="k">Make % from 3 to 10 ft</span>
          <span className="v num">
            {pctText(scoringPct)} <span className="small muted">{s.scoring.makes}/{s.scoring.attempts}</span>
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Feet of putts holed</span>
          <span className="v num">{s.makesTotalFeet}</span>
        </div>
        {round.score !== undefined && (
          <div className="stat-row">
            <span className="k">Score</span>
            <span className="v num">{round.score}</span>
          </div>
        )}
        {s.scoredHoles > 0 ? (
          <div className="stat-row">
            <span className="k">Greens in regulation</span>
            <span className="v num">
              {s.gir}
              <span className="small muted"> of {s.scoredHoles} scored</span>
            </span>
          </div>
        ) : null}
      </div>

      <h2>By distance</h2>
      <DistanceTable stats={s} />

      <h2>Lag control</h2>
      <LagPanel stats={s} lag={lagSaves([round])} />

      {form && (
        <>
          <h2>Form</h2>
          <FormPanel form={form} />
        </>
      )}

      {read.judged > 0 && (
        <>
          <h2>The read</h2>
          <ReadPanel read={read} />
        </>
      )}

      <h2>Miss patterns</h2>
      <PatternPanel stats={s} />

      <h2>What to work on</h2>
      <InsightList stats={s} />

      <h2>Scorecard</h2>
      {suspect.length > 0 && (
        <p className="small neg" style={{ margin: '0 0 8px' }}>
          Worth a look:{' '}
          {suspect.map((x) => `hole ${x.hole} (${x.from} ft then ${x.to} ft)`).join(', ')}. Running
          a putt well past is normal, but a leave that much longer than the putt is usually a
          mistyped distance. Tap the hole if it needs fixing.
        </p>
      )}
      <div className="sc-wrap">

        {round.holes.map((h) => (
          <button
            key={h.hole}
            className={h.putts.length >= 3 ? 'sc-row three' : 'sc-row'}
            onClick={() => {
              setEditPutt(null);
              setEditHole(h.hole);
            }}
          >
            <span className="h">{h.hole}</span>
            <span className="par-cell">{h.par ?? ''}</span>
            <span className="seq">
              {h.putts.length ? puttSequence(h.putts) : holedOut(h) ? 'chipped in' : '--'}
            </span>
            <span className="drop-cell">
              {marks.triggers.has(h.hole) ? (
                '🩸'
              ) : marks.bled.has(h.hole) ? (
                <span className="bled-dot" aria-label="bled into" />
              ) : (
                ''
              )}
            </span>
            <ScoreMark strokes={h.strokes} vsPar={holeVsPar(h)} />
            <span className={(running.get(h.hole) ?? 0) < 0 ? 'rel num pos' : 'rel num'}>
              {running.has(h.hole) ? fmtVsPar(running.get(h.hole)!) : ''}
            </span>
            <span className="n num">{h.putts.length || ''}</span>
            <SgCell value={sgOf(h)} />
          </button>
        ))}

        {(round.holeCount > 9
          ? [
              { label: 'Out', from: 1, to: 9 },
              { label: 'In', from: 10, to: 18 },
              { label: 'Total', from: 1, to: round.holeCount },
            ]
          : [{ label: 'Total', from: 1, to: round.holeCount }]
        ).map((band) => {
          const inBand = round.holes.filter((h) => h.hole >= band.from && h.hole <= band.to);
          // Par only counts holes actually played, so a round finished early doesn't show
          // a full nine's par next to a partial score.
          const par = inBand.reduce((n, h) => n + (h.strokes !== undefined ? h.par ?? 0 : 0), 0);
          const strokes = inBand.reduce((n, h) => n + (h.strokes ?? 0), 0);
          const putts = inBand.reduce((n, h) => n + h.putts.length, 0);
          const rel = inBand.reduce((n, h) => n + (holeVsPar(h) ?? 0), 0);
          const scored = inBand.some((h) => h.strokes !== undefined);
          return (
            <div
              key={band.label}
              className={band.label === 'Total' ? 'sc-row sc-total sc-grand' : 'sc-row sc-total'}
            >
              <span className="h" />
              <span className="par-cell">{par || ''}</span>
              <span className="seq band">{band.label}</span>
              <span className="drop-cell" />
              <span className="sc num">{scored ? strokes : ''}</span>
              <span className={rel < 0 ? 'rel num pos' : 'rel num'}>
                {scored ? fmtVsPar(rel) : ''}
              </span>
              <span className="n num">{putts || ''}</span>
              <SgCell
                value={inBand.some((h) => h.putts.length) ? inBand.reduce((n, h) => n + (sgOf(h) ?? 0), 0) : null}
              />
            </div>
          );
        })}
      </div>

      <p className="small muted" style={{ margin: '8px 0 0' }}>
        The last column is putting strokes gained on that hole, against what the average putt from
        your first putt's distance is worth. The bold reds are where the round went.
      </p>

      {bleeds.length > 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          🩸 is the mistake itself. A dot is a hole it bled into, not a hole that did anything
          wrong on the green.{' '}
          {bleeds.map((b) => `Hole ${b.triggerHole}, ${b.why}, ${b.shots} shot${b.shots === 1 ? '' : 's'}`).join('. ')}.
        </p>
      )}

      {hole && (
        <Sheet
          title={editPutt === null ? `Hole ${hole.hole}` : `Hole ${hole.hole} · Putt ${editPutt + 1}`}
          onClose={() => (editPutt === null ? setEditHole(null) : setEditPutt(null))}
        >
          {/* Two levels. All the putts on a hole opened at once put three miss grids and three
              break pickers on one screen, and finding the putt you meant was a scroll. */}
          {editPutt === null || !hole.putts[editPutt] ? (
            <>
              <HoleScore
                hole={hole}
                onChange={(patch) =>
                  dispatch({ t: 'setHoleScore', roundId: round.id, hole: hole.hole, patch })
                }
              />

              <div className="field-label">Putts</div>
              {hole.putts.length === 0 ? (
                <p className="small muted" style={{ margin: 0 }}>
                  No putts logged on this hole.
                </p>
              ) : (
                <div className="putt-cards">
                  {hole.putts.map((p, i) => {
                    const xp = xpOf(makeModel, state.baseline, p);
                    const chance = makeChanceOf(makeModel, p);
                    const verdict = verdictOf(makeModel, state.baseline, hole.putts, i);
                    // Telescoped, so the leftover putt's difficulty is not charged twice.
                    const adj = holeAdjustments(makeModel, state.baseline, hole.putts)[i];
                    const base = expectedPutts(state.baseline, p.d);
                    const leave = i + 1 < hole.putts.length ? hole.putts[i + 1].d : null;
                    const sgPlain = puttSG(state.baseline, p.d, p.made, leave);
                    const sgAdj = puttSGAdjusted(makeModel, state.baseline, hole.putts, i);
                    const faults = FAULT_WORDS.filter(([k]) => (p as never)[k]).map(([, w]) => w);
                    if (p.strike === 'toe') faults.push('toe strike');
                    if (p.strike === 'heel') faults.push('heel strike');
                    const execution = faults.length
                      ? faults.join(', ')
                      : p.executionAssessed
                        ? 'nothing wrong'
                        : 'not assessed';
                    return (
                      <button className="putt-card" key={i} onClick={() => setEditPutt(i)}>
                        <span className="pc-head">
                          <span className="pc-n">{i + 1}</span>
                          <span className="pc-d">{p.d} ft</span>
                          <span className="pc-shape">{breakLabel(breakDirsOf(p)) || 'untagged'}</span>
                          {verdict ? (
                            <span className={`verdict v-${verdict}`}>{VERDICT_LABEL[verdict]}</span>
                          ) : null}
                        </span>

                        {xp !== null && (
                          <span className="pc-grid">
                            <span className="pc-cell">
                              <span className="pc-k">Expected putts</span>
                              <span className="pc-v">{xp.toFixed(2)}</span>
                            </span>
                            <span className="pc-cell">
                              <span className="pc-k">Chance it drops</span>
                              <span className="pc-v">{Math.round((chance ?? 0) * 100)}%</span>
                            </span>
                            <span className="pc-cell">
                              <span className="pc-k">Distance alone</span>
                              <span className="pc-v quiet">{base.toFixed(2)}</span>
                            </span>
                            <span className="pc-cell">
                              <span className="pc-k">Its shape</span>
                              <span className="pc-v quiet">
                                {adj === null || Math.abs(adj) < 0.005
                                  ? '—'
                                  : `${adj > 0 ? '+' : ''}${adj.toFixed(2)}`}
                              </span>
                            </span>
                          </span>
                        )}

                        <span className="pc-line">
                          <span className="pc-k">Result</span>
                          <span className="pc-t">
                            {p.made ? 'holed' : leave !== null ? `missed · left ${leave} ft` : 'missed'}
                          </span>
                        </span>
                        <span className="pc-line">
                          <span className="pc-k">Execution</span>
                          <span className={p.executionAssessed ? 'pc-t' : 'pc-t quiet'}>{execution}</span>
                        </span>
                        {sgPlain !== null && (
                          <span className="pc-line">
                            <span className="pc-k">Strokes gained</span>
                            <span className="pc-t">
                              {signed(sgPlain)}
                              {sgAdj !== null && Math.abs(sgAdj - sgPlain) >= 0.005 ? (
                                <span className="pc-adj"> → {signed(sgAdj)} with break</span>
                              ) : null}
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                className="btn btn-wide"
                style={{ marginTop: 12 }}
                onClick={() => {
                  // The new putt lands on the end, so that is the one to open.
                  const at = hole.putts.length;
                  dispatch({
                    t: 'insertPutt',
                    roundId: round.id,
                    hole: hole.hole,
                    putt: { d: 2, made: true },
                  });
                  setEditPutt(at);
                }}
              >
                Add a putt
              </button>

              <button
                className="btn btn-primary btn-wide"
                style={{ marginTop: 10 }}
                onClick={() => setEditHole(null)}
              >
                Save
              </button>
              <p className="small muted" style={{ margin: '8px 0 0' }}>
                Every edit is kept as you make it. Save just takes you back to the card.
              </p>
            </>
          ) : (
            <>
              <PuttEditor
                putt={hole.putts[editPutt]}
                n={editPutt + 1}
                onPatch={(patch) =>
                  dispatch({
                    t: 'updatePutt',
                    roundId: round.id,
                    hole: hole.hole,
                    index: editPutt,
                    patch,
                  })
                }
                onRemove={() => {
                  dispatch({
                    t: 'removePutt',
                    roundId: round.id,
                    hole: hole.hole,
                    index: editPutt,
                  });
                  setEditPutt(null);
                }}
              />
              <button
                className="btn btn-primary btn-wide"
                onClick={() => setEditPutt(null)}
              >
                Done
              </button>
            </>
          )}
        </Sheet>
      )}

      {editing && (
        <Sheet title="Edit round" onClose={() => setEditing(false)}>
          <div className="field-label">Date</div>
          <input
            type="date"
            value={round.date}
            onChange={(e) => dispatch({ t: 'updateRound', id: round.id, patch: { date: e.target.value } })}
          />
          {/* Typing a name here used to be all you could do, which left the pars blank for good
              on a round saved before its course had tees. Picking the tee fills them in. */}
          <div className="field-label">Course</div>
          <button className="btn btn-ghost btn-wide" onClick={() => setCourseOpen(true)}>
            {round.course ? `${round.course}${round.tee ? ` · ${round.tee}` : ''}` : 'Pick a course'}
          </button>
          {round.course && !round.tee && (
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              No tee on this round, so the holes have no par. Pick one to fill them in.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="field-label">First nine</div>
              <input
                type="text"
                value={round.firstNine ?? ''}
                onChange={(e) =>
                  dispatch({
                    t: 'updateRound',
                    id: round.id,
                    patch: { firstNine: e.target.value || undefined },
                  })
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="field-label">Second nine</div>
              <input
                type="text"
                value={round.secondNine ?? ''}
                onChange={(e) =>
                  dispatch({
                    t: 'updateRound',
                    id: round.id,
                    patch: { secondNine: e.target.value || undefined },
                  })
                }
              />
            </div>
          </div>

          <div className="field-label">Putter</div>
          <div className="chips">
            {state.putters.map((p) => (
              <button
                key={p.id}
                className={p.id === round.putterId ? 'chip chip-sel' : 'chip'}
                onClick={() => dispatch({ t: 'updateRound', id: round.id, patch: { putterId: p.id } })}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="field-label">Score</div>
          <input
            type="number"
            inputMode="numeric"
            value={round.score ?? ''}
            onChange={(e) =>
              dispatch({
                t: 'updateRound',
                id: round.id,
                patch: { score: e.target.value ? Number(e.target.value) : undefined },
              })
            }
          />
          <div className="field-label">Putts written on the card</div>
          <input
            type="number"
            inputMode="numeric"
            value={round.recordedPutts ?? ''}
            onChange={(e) =>
              dispatch({
                t: 'updateRound',
                id: round.id,
                patch: { recordedPutts: e.target.value ? Number(e.target.value) : undefined },
              })
            }
          />
          <p className="small muted">
            Only fill this in if the card disagrees with what you logged. The tally is what every stat uses.
          </p>
        </Sheet>
      )}
      {courseOpen && (
        <Sheet title="Course" onClose={() => setCourseOpen(false)}>
          <CoursePicker
            holeCount={round.holeCount}
            value={{ name: round.course ?? '', courseId: round.courseId, tee: round.tee }}
            onChange={(c) => {
              dispatch({
                t: 'applyCourse',
                roundId: round.id,
                course: c.name,
                courseId: c.courseId,
                tee: c.tee,
                pars: c.pars,
              });
              if (c.pars?.length) setCourseOpen(false);
            }}
          />
        </Sheet>
      )}
    </>
  );
}
