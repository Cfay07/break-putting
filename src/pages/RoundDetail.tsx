import { useState } from 'react';
import { bleedMarks, bleedsIn } from '../lib/bleed';
import { ConfirmButton } from '../components/ConfirmButton';
import { ScoreMark } from '../components/ScoreMark';
import { DistanceTable } from '../components/DistanceTable';
import { HoleScore, fmtVsPar } from '../components/HoleScore';
import { InsightList } from '../components/InsightList';
import { LagPanel } from '../components/LagPanel';
import { PatternPanel } from '../components/PatternPanel';
import { PutterTag } from '../components/PutterTag';
import { Seg } from '../components/Seg';
import { SegMulti } from '../components/SegMulti';
import { Sheet } from '../components/Sheet';
import { fmtDateLong, pctText, puttSequence, signed } from '../lib/format';
import { go } from '../lib/router';
import { pct, roundStats, suspectHoles } from '../lib/stats';
import { useApp } from '../lib/store';
import {
  BREAK_DIRS,
  BREAK_LABELS,
  breakDirsOf,
  breakLabel,
  toggleBreak,
  FACTORS,
  FACTOR_LABELS,
  holeVsPar,
  holedOut,
  type MissSide,
  type Speed,
} from '../lib/types';

const MISS_SIDES: MissSide[] = ['high', 'low', 'online'];
const MISS_LABELS = { high: 'High', low: 'Low', online: 'On line' };
const SPEEDS: Speed[] = ['short', 'good', 'long'];
const SPEED_LABELS = { short: 'Short', good: 'Good', long: 'Long' };

export function RoundDetail({ id }: { id: string }) {
  const { state, dispatch } = useApp();
  const round = state.rounds.find((r) => r.id === id);
  const [editHole, setEditHole] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

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
          <span className="v num">{s.puttsPerHole.toFixed(2)}</span>
        </div>
        <div className="stat-row">
          <span className="k">Strokes gained putting</span>
          <span className={s.sg >= 0 ? 'v num pos' : 'v num neg'}>{signed(s.sg, 2)}</span>
        </div>
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
          <span className="k">Scoring range (3-10 ft)</span>
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
        ) : (
          round.greens !== undefined && (
            <div className="stat-row">
              <span className="k">Greens hit</span>
              <span className="v num">{round.greens}</span>
            </div>
          )
        )}
      </div>

      <h2>By distance</h2>
      <DistanceTable stats={s} />

      <h2>Lag control</h2>
      <LagPanel stats={s} />

      <h2>Miss patterns</h2>
      <PatternPanel stats={s} />

      <h2>What to work on</h2>
      <InsightList stats={s} />

      <h2>Scorecard</h2>
      {suspect.length > 0 && (
        <p className="small neg" style={{ margin: '0 0 8px' }}>
          Check{' '}
          {suspect.map((x) => `hole ${x.hole} (${x.from} ft then ${x.to} ft)`).join(', ')}. A putt
          cannot finish farther from the hole than it started, so a distance there is wrong. Tap the
          hole to fix it.
        </p>
      )}
      <div className="sc-wrap">

        {round.holes.map((h) => (
          <button
            key={h.hole}
            className={h.putts.length >= 3 ? 'sc-row three' : 'sc-row'}
            onClick={() => setEditHole(h.hole)}
          >
            <span className="h">{h.hole}</span>
            <span className="par-cell">{h.par ?? ''}</span>
            <span className="seq">
              {h.putts.length ? puttSequence(h.putts) : holedOut(h) ? 'chipped in' : '--'}
            </span>
            <span className="drop-cell">
              {marks.triggers.has(h.hole) || marks.bled.has(h.hole) ? '🩸' : ''}
            </span>
            <ScoreMark strokes={h.strokes} vsPar={holeVsPar(h)} />
            <span className={(running.get(h.hole) ?? 0) < 0 ? 'rel num pos' : 'rel num'}>
              {running.has(h.hole) ? fmtVsPar(running.get(h.hole)!) : ''}
            </span>
            <span className="n num">{h.putts.length || ''}</span>
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
            </div>
          );
        })}
      </div>

      {bleeds.length > 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          🩸 marks a putting mistake and the holes it bled into.{' '}
          {bleeds.map((b) => `Hole ${b.triggerHole}, ${b.why}, ${b.shots} shot${b.shots === 1 ? '' : 's'}`).join('. ')}.
        </p>
      )}

      {hole && (
        <Sheet title={`Hole ${hole.hole}`} onClose={() => setEditHole(null)}>
          <HoleScore
            hole={hole}
            onChange={(patch) =>
              dispatch({ t: 'setHoleScore', roundId: round.id, hole: hole.hole, patch })
            }
          />
          <div style={{ height: 16 }} />
          {hole.putts.length === 0 && <p className="small muted">No putts logged on this hole.</p>}
          {hole.putts.map((p, i) => (
            <div className="card" key={i} style={{ marginBottom: 12 }}>
              <div className="round-head">
                <h3>
                  Putt {i + 1} · {p.d} ft {p.made ? 'in' : 'missed'}
                </h3>
                <button
                  className="linkish tiny"
                  onClick={() =>
                    dispatch({ t: 'removePutt', roundId: round.id, hole: hole.hole, index: i })
                  }
                >
                  Remove
                </button>
              </div>
              <div className="field-label">Distance (ft)</div>
              <input
                type="number"
                inputMode="numeric"
                value={p.d}
                onChange={(e) =>
                  dispatch({
                    t: 'updatePutt',
                    roundId: round.id,
                    hole: hole.hole,
                    index: i,
                    patch: { d: Math.max(1, Number(e.target.value) || 1) },
                  })
                }
              />
              {!p.made && (
                <>
                  <div className="field-label">Miss side</div>
                  <Seg
                    options={MISS_SIDES}
                    labels={MISS_LABELS}
                    value={p.missSide}
                    onPick={(v) =>
                      dispatch({
                        t: 'updatePutt',
                        roundId: round.id,
                        hole: hole.hole,
                        index: i,
                        patch: { missSide: v },
                      })
                    }
                  />
                  <div className="field-label">Speed</div>
                  <Seg
                    options={SPEEDS}
                    labels={SPEED_LABELS}
                    value={p.speed}
                    onPick={(v) =>
                      dispatch({
                        t: 'updatePutt',
                        roundId: round.id,
                        hole: hole.hole,
                        index: i,
                        patch: { speed: v },
                      })
                    }
                  />
                  <div className="field-label">
                    How it broke
                    {breakLabel(breakDirsOf(p)) ? (
                      <span className="muted"> · {breakLabel(breakDirsOf(p))}</span>
                    ) : null}
                  </div>
                  <SegMulti
                    quiet
                    options={BREAK_DIRS}
                    labels={BREAK_LABELS}
                    values={breakDirsOf(p)}
                    onToggle={(v) =>
                      dispatch({
                        t: 'updatePutt',
                        roundId: round.id,
                        hole: hole.hole,
                        index: i,
                        patch: { breakDirs: toggleBreak(breakDirsOf(p), v), breakDir: undefined },
                      })
                    }
                  />
                </>
              )}
              <div className="field-label">Factors</div>
              <div className="chips">
                {FACTORS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={p[f] ? 'chip chip-sel' : 'chip'}
                    aria-pressed={!!p[f]}
                    onClick={() =>
                      dispatch({
                        t: 'updatePutt',
                        roundId: round.id,
                        hole: hole.hole,
                        index: i,
                        patch: { [f]: !p[f] },
                      })
                    }
                  >
                    {FACTOR_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
          <div className="field-label">Course</div>
          <input
            type="text"
            value={round.course ?? ''}
            onChange={(e) => dispatch({ t: 'updateRound', id: round.id, patch: { course: e.target.value } })}
          />
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
          <div className="field-label">Greens hit</div>
          <input
            type="number"
            inputMode="numeric"
            value={round.greens ?? ''}
            onChange={(e) =>
              dispatch({
                t: 'updateRound',
                id: round.id,
                patch: { greens: e.target.value ? Number(e.target.value) : undefined },
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
    </>
  );
}
