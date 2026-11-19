import { useMemo, useState } from 'react';
import { bleedMarks, bleedsIn } from '../lib/bleed';
import { holeSG, puttSG } from '../lib/sg';
import { fitMakeModel } from '../lib/makeability';
import {
  fitExecModel,
  difficultyOf,
  roomOf,
  xpotStatus,
  makeChanceOf,
  puttSGAdjusted,
  roundSGAdjusted,
  beatSpread,
  xpOf,
} from '../lib/xp';
import { drawRoundSheet, pngFile } from '../lib/shareCard';
import { publishRound, shareUrl } from '../lib/shareLink';
import { currentSession } from '../lib/cloud';
import { ConfirmButton } from '../components/ConfirmButton';
import { SURFACE_LABELS } from '../lib/types';
import { ScoreMark } from '../components/ScoreMark';
import { HoleScore, fmtVsPar } from '../components/HoleScore';
import { RoundPayoff } from '../components/RoundPayoff';
import { teeOf } from '../lib/courses';
import { useCourseRatings } from '../lib/useCourseRatings';
import { RoundStory, RoundTrophies } from '../components/RoundTrophies';
import { DistanceTable } from '../components/DistanceTable';
import { LagPanel } from '../components/LagPanel';
import { FormPanel } from '../components/FormPanel';
import { ReadPanel } from '../components/ReadPanel';
import { PatternPanel } from '../components/PatternPanel';
import { BeatBar } from '../components/BeatBar';
import { CupMap, cupCounts } from '../components/CupMap';
import { formOf } from '../lib/form';
import { readError } from '../lib/readError';
import { swingHoles, usual } from '../lib/roundRanks';
import { GreenSpeedPick } from '../components/GreenSpeedPick';
import { Conditions } from '../components/Conditions';
import { CoursePicker } from '../components/CoursePicker';
import { PuttEditor } from '../components/PuttEditor';
import { SpeedBars } from '../components/SpeedBars';
import { Sheet } from '../components/Sheet';
import { fmtDateLong, pctText, puttSequence, signed } from '../lib/format';
import { backLabel, go, previousRoute, replaceRoute } from '../lib/router';
import { lagSaves, ninesOf, pct, roundStats, suspectHoles } from '../lib/stats';
import { findRound, useApp } from '../lib/store';
import { breakDirsOf, breakLabel, holeVsPar, holedOut } from '../lib/types';

/**
 * Putting strokes gained on one hole. Half a shot is the line where a hole stops being a bad
 * break and starts being the reason the round went: those get the weight so the eye finds them
 * without reading every number.
 */
type RoundTab = 'holes' | 'distance' | 'lag' | 'misses' | 'cup' | 'form';

const FAULT_WORDS: [string, string][] = [
  ['push', 'push'],
  ['pull', 'pull'],
  ['decel', 'quit on it'],
  ['accel', 'jabbed it'],
  ['wrongWay', 'read it the wrong way'],
];

function SgCell({ value }: { value: number | null }) {
  if (value === null) return <span className="sg" />;
  const cls = value <= -0.5 ? 'sg down big' : value < 0 ? 'sg down' : value > 0 ? 'sg up' : 'sg';
  return <span className={cls}>{value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)}</span>;
}

export function RoundDetail({ id, openHole }: { id: string; openHole?: number }) {
  const { state, dispatch } = useApp();
  const courses = useCourseRatings();
  const round = findRound(state, id);
  const tee = round ? teeOf(round, courses) : undefined;
  const practice = !!round?.practice;
  // Back to wherever the round was opened from: Stats, a moment, a session. A reload has no
  // trail, so it falls back to the list the round lives in.
  const from = previousRoute();
  const back = from && !from.startsWith('/round/') ? from : practice ? '/stats/practice' : '/';
  // Fitted on every round, not just this one: one round is nowhere near enough break to learn from.
  const makeModel = useMemo(() => fitMakeModel(state.rounds), [state.rounds]);
  const exec = useMemo(() => fitExecModel(makeModel, state.rounds), [makeModel, state.rounds]);
  // Each hole counted once, from its first putt: xP already holds the putts that follow it. It
  // reads the break, so it is not putts plus strokes gained and is not meant to be.
  const roundXp = useMemo(() => {
    if (!round || !makeModel.ready) return null;
    let sum = 0;
    for (const h of round.holes) {
      if (!h.putts.length) continue;
      const v = xpOf(makeModel, state.baseline, h.putts[0]);
      if (v === null) return null;
      sum += v;
    }
    return sum;
  }, [makeModel, state.baseline, round]);
  const roundXpot = useMemo(() => {
    if (!round || !makeModel.ready) return null;
    let sum = 0;
    for (const h of round.holes) {
      if (!h.putts.length) continue;
      const st = xpotStatus(makeModel, exec, state.baseline, h.putts[0]);
      if (!st.ok) return null;
      sum += st.xpot;
    }
    return sum;
  }, [makeModel, exec, state.baseline, round]);
  const sgAdjusted = useMemo(
    () => (round ? roundSGAdjusted(makeModel, state.baseline, round.holes) : null),
    [makeModel, state.baseline, round],
  );
  // Opened straight from a stat that names a hole, so the link lands where it is pointing.
  const [editHole, setEditHole] = useState<number | null>(openHole ?? null);
  const [editPutt, setEditPutt] = useState<number | null>(null);
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [speedSheet, setSpeedSheet] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [whyXp, setWhyXp] = useState(false);
  // One breakdown at a time under the numbers. Holes first: it is the round itself.
  const [tab, setTab] = useState<RoundTab>('holes');

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
  const mismatch = round.recordedPutts && round.recordedPutts !== s.totalPutts;
  const scoringPct = pct(s.scoring);
  // The old "The numbers" card, in the recap's tile grid. Rows of four: the count, how the
  // putts went, then what only some rounds have (a score, a fitted model).
  // Your usual sits under the counts, so every number says whether today was good for you.
  const usualOf = (key: string, fmt: (v: number) => string) => {
    const u = round.practice ? null : usual(round, state.rounds, state.baseline, key);
    return u === null ? undefined : `usual ${fmt(u)}`;
  };
  const better = (mine: number, key: string, lowBetter: boolean) => {
    const u = round.practice ? null : usual(round, state.rounds, state.baseline, key);
    if (u === null || mine === u) return undefined;
    return (lowBetter ? mine < u : mine > u) ? 'pos' : 'neg';
  };
  const numberTiles: { k: string; v: string; cls?: string; sub?: string }[] = [
    {
      k: 'Putts',
      v: String(s.totalPutts),
      sub: usualOf('putts', (v) => String(Math.round(v))),
      cls: better(s.totalPutts, 'putts', true),
    },
    ...(roundXp !== null ? [{ k: 'Expected', v: roundXp.toFixed(1), sub: 'putts, xP' }] : []),
    ...(practice ? [{ k: 'Gained', v: signed(s.sg), cls: s.sg >= 0 ? 'pos' : 'neg' }] : []),
    { k: 'Per hole', v: s.puttsPerHole.toFixed(1) },
    {
      k: '1-putts',
      v: String(s.onePutts),
      sub: usualOf('ones', (v) => String(Math.round(v))),
      cls: better(s.onePutts, 'ones', false),
    },
    { k: '2-putts', v: String(s.twoPutts) },
    {
      k: '3-putts',
      v: String(s.threePlus),
      sub: usualOf('threes', (v) => String(Math.round(v))),
      cls: better(s.threePlus, 'threes', true),
    },
    {
      k: '3 to 10 ft',
      v: pctText(scoringPct),
      sub:
        usualOf('scoring', (v) => `${Math.round(v * 100)}%`) ??
        (s.scoring.attempts ? `${s.scoring.makes} of ${s.scoring.attempts}` : undefined),
      cls: scoringPct === null ? undefined : better(scoringPct / 100, 'scoring', false),
    },
    {
      k: 'Holed',
      v: String(s.makesTotalFeet),
      sub: usualOf('feet', (v) => `${Math.round(v)} ft`) ?? 'feet',
      cls: better(s.makesTotalFeet, 'feet', false),
    },
  ];
  const longest = Math.max(0, ...round.holes.flatMap((h) => h.putts.filter((p) => p.made).map((p) => p.d)));
  if (longest)
    numberTiles.push({
      k: 'Longest',
      v: String(longest),
      sub: usualOf('longest', (v) => `${Math.round(v)} ft`) ?? 'feet holed',
      cls: better(longest, 'longest', false),
    });
  if (practice && round.score !== undefined) numberTiles.push({ k: 'Score', v: String(round.score) });
  if (s.scoredHoles > 0) numberTiles.push({ k: 'Greens', v: String(s.gir), sub: `of ${s.scoredHoles}` });
  // Only where the break moves it by a quarter of a stroke: below that it was noise on most rounds.
  if (sgAdjusted !== null && Math.abs(sgAdjusted - s.sg) >= 0.25)
    numberTiles.push({ k: 'With break', v: signed(sgAdjusted), cls: sgAdjusted >= 0 ? 'pos' : 'neg' });
  if (roundXpot !== null) numberTiles.push({ k: 'After stroke', v: roundXpot.toFixed(1), sub: 'putts' });
  const hole = editHole !== null ? round.holes.find((h) => h.hole === editHole) : undefined;

  const sgOf = (h: { putts: { d: number }[] }) =>
    h.putts.length
      ? holeSG(
          state.baseline,
          h.putts.map((p) => p.d),
          h.putts.length,
        )
      : null;
  const marks = bleedMarks(round);
  const bleeds = bleedsIn(round);
  const suspect = suspectHoles(round);
  // The hole that made the round and the one that cost it, marked on the card.
  const swing = swingHoles(round, state.baseline);
  const tags = new Map<number, { text: string; fix: boolean }>();
  if (swing && swing.best.sg > 0) tags.set(swing.best.hole, { text: 'Best hole', fix: false });
  if (swing && swing.worst.sg < 0) tags.set(swing.worst.hole, { text: 'Cost the most', fix: true });
  const cup = cupCounts(round.holes);
  const read = readError([round]);
  const form = round.practice ? null : formOf(round, state.baseline);
  const beats = beatSpread(state.baseline, [round as never]);
  const tabs: { key: RoundTab; label: string }[] = [
    { key: 'holes', label: 'Holes' },
    { key: 'distance', label: 'By distance' },
    { key: 'lag', label: 'Lag' },
    { key: 'misses', label: 'Misses' },
    ...(cup.total + cup.unsure > 0 ? [{ key: 'cup' as const, label: 'Cup' }] : []),
    ...(form ? [{ key: 'form' as const, label: 'Form' }] : []),
  ];
  const putterName = state.putters.find((p) => p.id === round.putterId)?.name;
  const nines = ninesOf(round);
  const share = () => {
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
  };

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

  // A nine logged on an eighteen-hole card used to draw nine rows of dashes under it.
  // Trimmed to the first and last hole with anything on it, so a skipped hole in the middle
  // stays tappable.
  const played = (h: (typeof round.holes)[number]) =>
    h.putts.length > 0 || h.strokes !== undefined || h.vsPar !== undefined || !!h.holedOut;
  const firstPlayed = round.holes.findIndex(played);
  const lastPlayed = round.holes.length - 1 - [...round.holes].reverse().findIndex(played);
  const playedHoles = firstPlayed < 0 ? round.holes : round.holes.slice(firstPlayed, lastPlayed + 1);

  return (
    <>
      <div style={{ marginBottom: 6 }}>
        <button className="linkish tiny" onClick={() => go(back)}>
          ← {practice && back === '/stats/practice' ? 'Practice stats' : backLabel(back)}
        </button>
      </div>
      <div className="round-top">
        <h3>{fmtDateLong(round.date)}</h3>
        <div className="round-actions">
          {!practice && (
            <button className="status-tag" disabled={sharing} onClick={share}>
              {sharing ? 'Sharing…' : 'Share'}
            </button>
          )}
          <button className="status-tag" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      </div>
      {practice && (
        <p className="small muted" style={{ margin: '2px 0 0' }}>
          Practice round · {SURFACE_LABELS[round.practice!.surface]}. Never counted in your round stats.
        </p>
      )}
      {round.course && (
        <p className="round-course">
          {round.course}
          {nines ? ` · ${nines}` : ''}
        </p>
      )}
      <div className="status-tags">
        {round.tee && !nines && (
          <span className="status-tag static">
            {round.tee} tees{tee?.rating && tee.slope ? ` · ${tee.rating.toFixed(1)}/${tee.slope}` : ''}
          </span>
        )}
        {nines && tee?.rating && tee.slope && (
          <span className="status-tag static">
            {tee.rating.toFixed(1)}/{tee.slope}
          </span>
        )}
        {putterName && <span className="status-tag static">{putterName}</span>}
        {!practice && (
          <>
            <button className="status-tag" onClick={() => setSpeedSheet(true)}>
              {round.greenSpeed ? <SpeedBars speed={round.greenSpeed} label /> : 'Green speed'}
            </button>
            <button
              className={round.competitive ? 'status-tag on' : 'status-tag'}
              aria-pressed={!!round.competitive}
              onClick={() => dispatch({ t: 'updateRound', id: round.id, patch: { competitive: !round.competitive } })}
            >
              {round.competitive ? 'Tournament' : 'Casual'}
            </button>
          </>
        )}
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
            How the greens rolled that day. Stats can be split by this, so a fast-green round is not averaged in with a
            slow one.
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

      {!practice && <RoundStory round={round} stats={s} baseline={state.baseline} />}

      <div className="round-numbers">
        {numberTiles.map((t) => (
          <div key={t.k}>
            <span>{t.k}</span>
            <strong className={t.cls ? `num ${t.cls}` : 'num'}>{t.v}</strong>
            {/* Every tile keeps the line, filled or not, so the rows stay the same height. */}
            <small>{t.sub ?? ''}</small>
          </div>
        ))}
      </div>
      {s.threePuttHoles.length > 0 && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Three-putts on {s.threePuttHoles.length === 1 ? 'hole' : 'holes'} {s.threePuttHoles.join(', ')}.
        </p>
      )}
      {mismatch && (
        <p className="small neg" style={{ margin: '6px 0 0' }}>
          The card says {round.recordedPutts} putts; {s.totalPutts} are logged here.
        </p>
      )}

      {!practice && <RoundTrophies round={round} rounds={state.rounds} baseline={state.baseline} />}

      <RoundPayoff round={round} />

      <div className="round-tabs" role="tablist" aria-label="Round breakdowns">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'chip chip-sel' : 'chip'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'distance' && <DistanceTable stats={s} countsOnly />}
      {tab === 'lag' && <LagPanel stats={s} lag={lagSaves([round])} />}
      {tab === 'misses' && (
        <>
          {read.judged > 0 && <ReadPanel read={read} />}
          <PatternPanel stats={s} />
        </>
      )}
      {tab === 'cup' && <CupMap counts={cup.counts} unsure={cup.unsure} />}
      {tab === 'form' && form && <FormPanel form={form} />}

      {tab === 'holes' && (
        <>
          {beats.n >= 6 && <BeatBar spread={beats} compact />}
          {suspect.length > 0 && (
            <p className="small neg" style={{ margin: '0 0 8px' }}>
              Worth a look: {suspect.map((x) => `hole ${x.hole} (${x.from} ft then ${x.to} ft)`).join(', ')}. Running a
              putt well past is normal, but a leave that much longer than the putt is usually a mistyped distance. Tap
              the hole if it needs fixing.
            </p>
          )}
          <div className="sc-wrap">
            {playedHoles.map((h) => (
              <button
                key={h.hole}
                className={[
                  'sc-row',
                  h.putts.length >= 3 ? 'three' : '',
                  tags.get(h.hole) && !tags.get(h.hole)!.fix ? 'tagged' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setEditPutt(null);
                  setEditHole(h.hole);
                }}
              >
                <span className="h">{h.hole}</span>
                <span className="par-cell">{h.par ?? ''}</span>
                <span className="seq">
                  {h.putts.length ? puttSequence(h.putts) : holedOut(h) ? 'chipped in' : '--'}
                  {tags.get(h.hole) && (
                    <span className={tags.get(h.hole)!.fix ? 'sc-tag fix' : 'sc-tag'}>{tags.get(h.hole)!.text}</span>
                  )}
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

            {(playedHoles.some((h) => h.hole <= 9) && playedHoles.some((h) => h.hole >= 10)
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
              const par = inBand.reduce((n, h) => n + (h.strokes !== undefined ? (h.par ?? 0) : 0), 0);
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
                  <span className={rel < 0 ? 'rel num pos' : 'rel num'}>{scored ? fmtVsPar(rel) : ''}</span>
                  <span className="n num">{putts || ''}</span>
                  <SgCell
                    value={inBand.some((h) => h.putts.length) ? inBand.reduce((n, h) => n + (sgOf(h) ?? 0), 0) : null}
                  />
                </div>
              );
            })}
          </div>

          <p className="small muted" style={{ margin: '8px 0 0' }}>
            The last column is putting strokes gained on that hole, against what the average putt from your first putt's
            distance is worth. The bold reds are where the round went.
          </p>

          {bleeds.length > 0 && (
            <p className="small muted" style={{ marginTop: 8 }}>
              🩸 is the mistake itself. A dot is a hole it bled into, not a hole that did anything wrong on the green.{' '}
              {bleeds
                .map((b) => `Hole ${b.triggerHole}, ${b.why}, ${b.shots} shot${b.shots === 1 ? '' : 's'}`)
                .join('. ')}
              .
            </p>
          )}
        </>
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
                onChange={(patch) => dispatch({ t: 'setHoleScore', roundId: round.id, hole: hole.hole, patch })}
              />

              <div className="field-label">Putts</div>
              {hole.putts.length === 0 ? (
                <p className="small muted" style={{ margin: 0 }}>
                  No putts logged on this hole.
                </p>
              ) : (
                <div className="putt-cards">
                  {whyXp && (
                    <p className="why-note">
                      Two different sources in one number, which is worth knowing. The <b>level</b> comes from PGA Tour
                      averages, not from you: that is what makes strokes gained a comparison rather than a mirror. The{' '}
                      <b>break and slope adjustment</b> is fitted to your own putts. So xP reads "what a tour player
                      would expect from here, nudged by how this particular putt behaves for you".
                    </p>
                  )}
                  {hole.putts.map((p, i) => {
                    const xp = xpOf(makeModel, state.baseline, p);
                    const chance = makeChanceOf(makeModel, p);
                    const xpot = xpotStatus(makeModel, exec, state.baseline, p);
                    // This putt's own adjustment, so the grid reads as xP minus the straight
                    // baseline. The telescoped version belongs to the hole, not to one cell.
                    const adj = difficultyOf(makeModel, state.baseline, p);
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
                        </span>

                        {xp !== null && (
                          <span className="pc-grid">
                            <span className="pc-cell">
                              <span className="pc-k">
                                Expected putts (xP)
                                <button
                                  type="button"
                                  className="why"
                                  aria-expanded={whyXp}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setWhyXp(!whyXp);
                                  }}
                                >
                                  ?
                                </button>
                              </span>
                              <span className="pc-v">{xp.toFixed(2)}</span>
                            </span>
                            <span className="pc-cell">
                              <span className="pc-k">Chance it drops</span>
                              <span className="pc-v">
                                {chance === null ? (
                                  <span className="pc-beyond">past anything you have hit</span>
                                ) : (
                                  `${Math.round(chance * 100)}%`
                                )}
                              </span>
                            </span>
                          </span>
                        )}

                        {adj !== null && Math.abs(adj) >= 0.005 && (
                          <span className="pc-line">
                            <span className="pc-k">
                              The break added
                              <span className="pc-sub"> vs the same length straight</span>
                            </span>
                            <span className="pc-t pc-adj">
                              {adj > 0 ? '+' : ''}
                              {adj.toFixed(2)}
                            </span>
                          </span>
                        )}
                        <span className="pc-line">
                          <span className="pc-k">Result</span>
                          <span className="pc-t">
                            {p.made ? 'holed' : leave !== null ? `missed · left ${leave} ft` : 'missed'}
                          </span>
                        </span>
                        {p.made && p.cupEntry && p.cupEntry !== 'unsure' && (
                          <span className="pc-line">
                            <span className="pc-k">Room to spare</span>
                            <span className="pc-t">
                              {roomOf(p.cupEntry) === null ? 'went in on pace' : `${roomOf(p.cupEntry)!.toFixed(2)} in`}
                            </span>
                          </span>
                        )}
                        <span className="pc-line">
                          <span className="pc-k">The stroke</span>
                          <span className={p.executionAssessed ? 'pc-t' : 'pc-t quiet'}>{execution}</span>
                        </span>
                        {xpot.ok && (
                          <span className="pc-line">
                            <span className="pc-k">After the stroke</span>
                            <span className="pc-t">
                              {xpot.xpot.toFixed(2)}
                              <span className="pc-adj">
                                {' '}
                                {xpot.cost >= 0 ? '+' : ''}
                                {xpot.cost.toFixed(2)} from the stroke
                              </span>
                            </span>
                          </span>
                        )}
                        {sgPlain !== null && (
                          <span className="pc-line">
                            <span className="pc-k">Strokes gained</span>
                            <span className="pc-t">{signed(sgPlain)}</span>
                          </span>
                        )}
                        {/* A separate row, never an arrow off the first one. Strokes gained itself
                            is untouched and distance-only; this is a second reading beside it. */}
                        {sgPlain !== null && sgAdj !== null && Math.abs(sgAdj - sgPlain) >= 0.005 && (
                          <span className="pc-line">
                            <span className="pc-k">Counting the break</span>
                            <span className="pc-t pc-adj">{signed(sgAdj)}</span>
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

              <button className="btn btn-primary btn-wide" style={{ marginTop: 10 }} onClick={() => setEditHole(null)}>
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
              <button className="btn btn-primary btn-wide" onClick={() => setEditPutt(null)}>
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
          <ConfirmButton
            className="btn btn-danger btn-wide"
            style={{ marginTop: 16 }}
            label="Delete round"
            confirmLabel="Tap again to delete"
            onConfirm={() => {
              dispatch({ t: 'deleteRound', id: round.id });
              replaceRoute(practice ? '/stats/practice' : '/');
            }}
          />
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
