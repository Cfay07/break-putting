import { useEffect, useMemo, useState } from 'react';
import { DistanceTable } from '../components/DistanceTable';
import { LagPanel } from '../components/LagPanel';
import { PatternPanel } from '../components/PatternPanel';
import { ScoreMark } from '../components/ScoreMark';
import { SpeedBars } from '../components/SpeedBars';
import { fmtVsPar } from '../components/HoleScore';
import { bleedMarks, bleedsIn } from '../lib/bleed';
import { fmtDateLong, pctText, puttSequence, signed } from '../lib/format';
import { holeSG } from '../lib/sg';
import { loadSharedRound, type SharedRound as Shared } from '../lib/shareLink';
import { courseLabel, lagSaves, pct, roundStats, DANGER_FROM } from '../lib/stats';
import { holeVsPar, holedOut } from '../lib/types';

/**
 * The whole round, for someone with the link and no account. Read only on purpose: there is no
 * store behind this page, just the snapshot that was shared and the baseline it was scored with.
 */
export function SharedRound({ token }: { token: string }) {
  const [state, setState] = useState<'loading' | 'missing' | 'error'>('loading');
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    loadSharedRound(token)
      .then((r) => {
        if (!live) return;
        if (!r) return setState('missing');
        setData(r);
        setState('loading');
      })
      .catch((e) => {
        if (!live) return;
        setError((e as Error).message);
        setState('error');
      });
    return () => {
      live = false;
    };
  }, [token]);

  const view = useMemo(() => {
    if (!data) return null;
    const { round, baseline } = data;
    return {
      round,
      baseline,
      stats: roundStats(round, baseline),
      lag: lagSaves([round]),
      marks: bleedMarks(round),
      bleeds: bleedsIn(round),
    };
  }, [data]);

  if (state === 'missing') {
    return (
      <>
        <div className="empty">
          <p>That link has expired or was never a round.</p>
        </div>
      </>
    );
  }
  if (state === 'error') {
    return (
      <>
        <div className="empty">
          <p>{error}</p>
        </div>
      </>
    );
  }
  if (!view) {
    return (
      <>
        <div className="empty">
          <p>Loading…</p>
        </div>
      </>
    );
  }

  const { round, baseline, stats: s, lag, marks, bleeds } = view;
  const scoringPct = pct(s.scoring);
  const bled = bleeds.reduce((n, b) => n + b.shots, 0);
  const sgOf = (h: { putts: { d: number }[] }) =>
    h.putts.length ? holeSG(baseline, h.putts.map((p) => p.d), h.putts.length) : null;

  const running = new Map<number, number>();
  let carried = 0;
  for (const h of round.holes) {
    const vs = holeVsPar(h);
    if (vs === undefined) continue;
    carried += vs;
    running.set(h.hole, carried);
  }

  const bands =
    round.holeCount > 9
      ? [
          { label: 'Out', from: 1, to: 9 },
          { label: 'In', from: 10, to: 18 },
          { label: 'Total', from: 1, to: round.holeCount },
        ]
      : [{ label: 'Total', from: 1, to: round.holeCount }];

  return (
    <>
      <div className="round-head">
        <h3 style={{ fontSize: 21 }}>{fmtDateLong(round.date)}</h3>
        {round.greenSpeed && <SpeedBars speed={round.greenSpeed} label />}
      </div>
      {courseLabel(round) && (
        <p className="small muted" style={{ margin: '2px 0 0' }}>
          {courseLabel(round)}
          {round.competitive ? ' · competitive' : ''}
        </p>
      )}
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        {data?.sharedBy ? `Shared by ${data.sharedBy}.` : 'Shared from BREAK!.'} You are seeing a
        copy, so nothing here changes if they log more rounds.
      </p>

      <h2>The numbers</h2>
      <div className="card">
        <Row k="Putts" v={String(s.totalPutts)} />
        <Row k="Putts per hole" v={s.puttsPerHole.toFixed(2)} />
        <Row
          k="Strokes gained putting"
          v={signed(s.sg, 2)}
          cls={s.sg >= 0 ? 'v num pos' : 'v num neg'}
        />
        <Row k="1 / 2 / 3+ putts" v={`${s.onePutts} / ${s.twoPutts} / ${s.threePlus}`} />
        <Row k="Make % from 3 to 10 ft" v={pctText(scoringPct)} />
        <Row k="Feet of putts holed" v={String(Math.round(s.makesTotalFeet))} />
        <Row k="Score" v={round.score != null ? String(round.score) : '--'} />
        {bled > 0 && (
          <Row k="Shots lost after a mistake" v={`-${bled}`} cls="v num neg" />
        )}
      </div>

      <h2>By distance</h2>
      <DistanceTable stats={s} />

      <h2>Lag control</h2>
      <LagPanel stats={s} lag={lag} />
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        Typical leave is every lag they hit. The comeback is only the ones that finished{' '}
        {DANGER_FROM}+ feet away, which is why it is the bigger number.
      </p>

      <h2>Miss patterns</h2>
      <PatternPanel stats={s} />

      <h2>Scorecard</h2>
      <div className="sc-wrap">
        {round.holes.map((h) => (
          <div key={h.hole} className={h.putts.length >= 3 ? 'sc-row three' : 'sc-row'}>
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
            <Sg value={sgOf(h)} />
          </div>
        ))}

        {bands.map((band) => {
          const inBand = round.holes.filter((h) => h.hole >= band.from && h.hole <= band.to);
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
              <Sg
                value={
                  inBand.some((h) => h.putts.length)
                    ? inBand.reduce((n, h) => n + (sgOf(h) ?? 0), 0)
                    : null
                }
              />
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        The last column is putting strokes gained on that hole, against what the average putt from
        their first putt's distance is worth.
      </p>

      {bleeds.length > 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          🩸 is the mistake itself. A dot is a hole it bled into.{' '}
          {bleeds
            .map((b) => `Hole ${b.triggerHole}, ${b.why}, ${b.shots} shot${b.shots === 1 ? '' : 's'}`)
            .join('. ')}
          .
        </p>
      )}

      <div style={{ margin: '28px 0 8px', textAlign: 'center' }}>
        <a className="btn btn-primary btn-wide" href="#/" style={{ textDecoration: 'none' }}>
          Track your own putting
        </a>
      </div>
    </>
  );
}

function Row({ k, v, cls = 'v num' }: { k: string; v: string; cls?: string }) {
  return (
    <div className="stat-row">
      <span className="k">{k}</span>
      <span className={cls}>{v}</span>
    </div>
  );
}

function Sg({ value }: { value: number | null }) {
  if (value === null) return <span className="sg" />;
  const cls = value <= -0.5 ? 'sg down big' : value < 0 ? 'sg down' : value > 0 ? 'sg up' : 'sg';
  return <span className={cls}>{value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)}</span>;
}
