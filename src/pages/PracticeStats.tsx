import { Chevron } from '../components/Chevron';
import { PracticeDays } from '../components/PracticeDays';
import { PracticeLog } from '../components/PracticeLog';
import { CarryList, MissBandsCard, PressureCard, SpotVsMixed, TargetCarry, TestTrendCard } from '../components/PracticeReview';
import { SetColumns } from '../components/SetColumns';
import { VsPlay } from '../components/VsPlay';
import { resolveDrill } from '../lib/drills';
import { fmtDate, signed } from '../lib/format';
import { sample, signedFor } from '../lib/sample';
import { biggestGap, byTime, histories, practiceVsPlay, RECENT_ROUNDS, totalsOf } from '../lib/practice';
import { setScoreShort } from '../lib/practiceView';
import { fitMakeModel, type MakeModel } from '../lib/makeability';
import { expectedPutts } from '../lib/sg';
import { overall, roundScale, roundStats } from '../lib/stats';
import { xpOf } from '../lib/xp';
import { useMemo } from 'react';
import { usePractice } from '../lib/usePractice';
import { SURFACE_LABELS, type Round, type Surface } from '../lib/types';

const SURFACES: Surface[] = ['indoor', 'green'];

interface Side {
  rounds: number;
  putts: number | null;
  /**
   * Expected putts per 18 from the first putts: how hard the putts were, distance and break
   * together, on the same footing as putts. Putts per 18 means little without it.
   */
  xp: number | null;
  sg: number | null;
  scoring: number | null;
  scoringOf: number;
  /** How far the first putts were, in feet. */
  first: number | null;
}

function sideOf(rounds: Round[], baseline: [number, number][], model: MakeModel): Side {
  const o = overall(rounds, baseline);
  const firsts = rounds.flatMap((r) => r.holes.filter((h) => h.putts.length).map((h) => h.putts[0].d));
  // A putt the model cannot read gets the distance-only baseline, which is what xP is with no shape.
  const xpRound = (r: Round) =>
    r.holes.filter((h) => h.putts.length).reduce((s, h) => s + (xpOf(model, baseline, h.putts[0]) ?? expectedPutts(baseline, h.putts[0].d)), 0) *
    roundScale(r);
  return {
    rounds: rounds.length,
    putts: o.puttsPerRound,
    xp: rounds.length ? rounds.reduce((s, r) => s + xpRound(r), 0) / rounds.length : null,
    sg: o.sgPerRound,
    scoring: o.scoringPct,
    scoringOf: o.pooled.scoring.attempts,
    first: firsts.length ? firsts.reduce((a, b) => a + b, 0) / firsts.length : null,
  };
}
const pct = (t: { made: number; attempts: number }) => Math.round((t.made / t.attempts) * 100);

/**
 * Everything practice has measured, in one place, next to your rounds but never mixed into
 * them. Each section only appears once there is something in it.
 */
export function PracticeStats() {
  const { state, scoped, family, fitted } = usePractice();
  const sets = state.practice;
  const list = histories(sets, family);
  const totals = totalsOf(sets);
  // Fitted on real rounds only: the yardstick is how you putt on a course.
  const model = useMemo(() => fitMakeModel(state.rounds.filter((r) => r.finished)), [state.rounds]);
  const played = (state.practiceRounds ?? []).filter((r) => r.finished).sort((a, b) => b.date.localeCompare(a.date));
  const prac = played.length ? overall(played, state.baseline) : null;
  // Indoor and green rounds never share a column: a mat breaks less and rolls truer, which flatters every number.
  const bySurface = SURFACES.map((sf) => {
    const rs = played.filter((r) => r.practice?.surface === sf);
    return { sf, n: rs.length, o: rs.length ? sideOf(rs, state.baseline, model) : null };
  }).filter((x) => x.o);
  const recent = [...scoped.rounds].sort((a, b) => a.date.localeCompare(b.date)).slice(-RECENT_ROUNDS);
  const real = recent.length ? sideOf(recent, state.baseline, model) : null;

  const record = new Map<string, { w: number; l: number; t: number }>();
  for (const s of sets) {
    if (!s.game) continue;
    const r = record.get(s.game.opponent) ?? { w: 0, l: 0, t: 0 };
    if (s.game.result === 'win') r.w++;
    else if (s.game.result === 'loss') r.l++;
    else r.t++;
    record.set(s.game.opponent, r);
  }

  const vs = SURFACES.map((s) => ({
    s,
    reads: practiceVsPlay(
      sets.filter((x) => x.surface === s),
      scoped.rounds,
    ).filter((r) => r.practice.attempts > 0),
  })).filter((p) => p.reads.length);

  if (!sets.length && !played.length) {
    return (
      <div>
        <TargetCarry />
        <p className="small muted" style={{ marginTop: 14 }}>
          Your weekly test, drills and practice rounds land here once you have rolled some.
        </p>
      </div>
    );
  }

  return (
    <div>
      <TargetCarry />
      <TestTrendCard />
      <CarryList />

      {prac && (
        <>
          <h2>Practice rounds</h2>
          <div className="table-wrap">
            <table className="hands-table">
              <thead>
                <tr>
                  <th />
                  {bySurface.map((x) => (
                    <th key={x.sf}>
                      {SURFACE_LABELS[x.sf]} ({x.n})
                    </th>
                  ))}
                  {real && <th>Last {recent.length} real</th>}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Putts per 18', (o: Side) => o.putts?.toFixed(1) ?? ''],
                    ['Average first putt', (o: Side) => (o.first !== null ? `${o.first.toFixed(1)} ft` : '')],
                    ['Expected putts (xP)', (o: Side) => o.xp?.toFixed(1) ?? ''],
                    ['Strokes gained per 18', (o: Side) => (o.sg !== null ? signedFor(o.sg, sample(o.rounds, 5, 'rounds')) : '')],
                    ['Holed from 3 to 10 ft', (o: Side) => (o.scoring !== null ? `${Math.round(o.scoring)}% of ${o.scoringOf}` : '')],
                  ] as const
                ).map(([k, f]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    {bySurface.map((x) => (
                      <td key={x.sf} className="num">
                        {f(x.o!)}
                      </td>
                    ))}
                    {real && <td className="num">{f(real)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bySurface.some((x) => x.sf === 'indoor') && (
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              A mat rolls truer and breaks less than a course, so it flatters every make. Read an indoor round against your other indoor rounds, not against
              a course. Expected putts says how hard each set of putts was, so compare putts against it.
            </p>
          )}
          <div className="row-list" style={{ marginTop: 10 }}>
            {played.map((r) => {
              const st = roundStats(r, state.baseline);
              return (
                <a key={r.id} className="nav-row" href={`#/round/${r.id}`}>
                  <span className="nav-main">
                    <strong>
                      {fmtDate(r.date)} · {SURFACE_LABELS[r.practice!.surface]}
                    </strong>
                    <span className="small muted">
                      {st.holesPlayed} holes · {st.totalPutts} putts · {signed(st.sg)} against scratch
                    </span>
                  </span>
                  <Chevron />
                </a>
              );
            })}
          </div>
        </>
      )}

      {vs.map(({ s, reads }) => (
        <div key={s}>
          <h2>Practice against play, {SURFACE_LABELS[s].toLowerCase()}</h2>
          <VsPlay reads={reads} />
        </div>
      ))}

      <SpotVsMixed />
      <MissBandsCard />
      <PressureCard />

      {list.length > 0 && (
        <>
          <h2>Your drills</h2>
          <div className="row-list">
            {list.map((h) => {
              const d = fitted(h.drill) ?? resolveDrill(state, h.drill);
              if (!d) return null;
              const gap = biggestGap(practiceVsPlay(h.sets, scoped.rounds));
              return (
                <a key={h.drill} className="drill-row" href={`#/practice/drill/${h.drill}`}>
                  <span className="drill-main">
                    <strong>{d.name}</strong>
                    <span className="small muted">
                      {gap ? (
                        <>
                          {gap.d} ft: {pct(gap.practice)}% here, <span className="play-ink">{pct(gap.play)}% in rounds</span>
                        </>
                      ) : (
                        `${h.sets.length} ${h.sets.length === 1 ? 'set' : 'sets'} · best ${setScoreShort(d, h.best)}`
                      )}
                    </span>
                  </span>
                  <SetColumns h={h} />
                  <span className="drill-last num">{setScoreShort(d, h.last)}</span>
                </a>
              );
            })}
          </div>
        </>
      )}

      {sets.some((x) => x.stations?.some((st) => st.hand)) && (
        <div className="row-list" style={{ marginTop: 18 }}>
          <a className="nav-row" href="#/practice/hands">
            <span className="nav-main">
              <strong>One hand at a time</strong>
              <span className="small muted">Left against right, and against your rounds</span>
            </span>
            <Chevron />
          </a>
        </div>
      )}

      {record.size > 0 && (
        <>
          <h2>Head to head</h2>
          {[...record.entries()]
            .sort((a, b) => b[1].w - a[1].w || a[1].l - b[1].l)
            .map(([who, r]) => (
              <div key={who} className="stat-row">
                <span className="k">{who}</span>
                <span className="v num">
                  {r.w}-{r.l}
                  {r.t ? `-${r.t}` : ''}
                </span>
              </div>
            ))}
        </>
      )}

      {sets.length > 0 && (
        <>
          <h2>Days you practiced</h2>
          <p className="small muted" style={{ margin: '0 0 8px' }}>
            {totals.sets} {totals.sets === 1 ? 'set' : 'sets'}, {totals.putts} putts, {totals.days}{' '}
            {totals.days === 1 ? 'day' : 'days'}. None of it counts toward your round stats.
          </p>
          <PracticeDays sets={[...sets].sort(byTime)} />
          <h2>Recent practice</h2>
          <PracticeLog limit={4} />
        </>
      )}
    </div>
  );
}
