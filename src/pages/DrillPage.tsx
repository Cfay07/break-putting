import { BackLink } from '../components/BackLink';
import { useState } from 'react';
import { ConfirmButton } from '../components/ConfirmButton';
import { DrillLogger } from '../components/DrillLogger';
import { SetColumns } from '../components/SetColumns';
import { VsPlay } from '../components/VsPlay';
import { distanceText, fitToRoom, resolveDrill, scoringLabel } from '../lib/drills';
import { fmtDate } from '../lib/format';
import { biggestGap, historyOf, practiceVsPlay, TREND_NEED, trendOf } from '../lib/practice';
import { ON_MISS_TEXT, setScore } from '../lib/practiceView';
import { usePractice } from '../lib/usePractice';
import { SURFACE_LABELS } from '../lib/types';

const SOURCE: Record<string, string> = { app: "BREAK!'s", import: 'Imported', mine: 'Yours' };

const pct = (t: { made: number; attempts: number }) => Math.round((t.made / t.attempts) * 100);

export function DrillPage({ id }: { id: string }) {
  const { state, dispatch, surface, room, scoped, family } = usePractice();
  const [rolling, setRolling] = useState(false);
  const drill = resolveDrill(state, id);
  if (!drill) {
    return (
      <div className="empty">
        That drill is gone. <a href="#/practice">Back to Practice</a>
      </div>
    );
  }
  const fitted = fitToRoom(drill, room);
  const usable = drill.surfaces.includes(surface);
  const h = historyOf(state.practice, family(drill.id), family);
  const moved = fitted.stations.filter((s) => s.movedFrom);
  const reads = h && drill.putting ? practiceVsPlay(h.sets, scoped.rounds) : [];
  const gap = biggestGap(reads);
  const latest = h?.last.surface;
  const trend = h ? trendOf(h.sets.filter((s) => s.surface === latest)) : null;
  const counted = trend && trend.earlier.attempts + trend.later.attempts;

  return (
    <div>
      <div className="page-top">
        <BackLink />
        <a href={`#/practice/edit/${drill.id}`} className="back-link">
          Edit
        </a>
      </div>
      <h1 className="page-title">{drill.name}</h1>
      <p className="small muted" style={{ margin: '2px 0 0' }}>
        {[distanceText(drill), scoringLabel(drill), SOURCE[drill.source] + (drill.from ? ', edited' : '')]
          .filter(Boolean)
          .join(' · ')}
      </p>

      <p className="small" style={{ marginTop: 12 }}>
        {drill.how}
        {drill.scoring === 'ladder' && ` ${ON_MISS_TEXT[drill.onMiss ?? 'end']}`}
        {drill.limit ? ` ${drill.limit} minutes on the clock.` : ''}
      </p>

      {!usable && (
        <p className="small note-line">
          This one needs real break and slope, so it is for a green.
        </p>
      )}
      {usable && moved.length > 0 && (
        <p className="small note-line">
          Fitted to your {room} ft: {[...new Set(moved.map((s) => s.movedFrom))].join(', ')} ft moved in to {room}.
        </p>
      )}

      {h && (
        <>
          <h2>Your sets</h2>
          <SetColumns h={h} max={30} tall />
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {h.sets.length} {h.sets.length === 1 ? 'set' : 'sets'} · best {setScore(drill, h.best)} · last{' '}
            {setScore(drill, h.last)}
          </p>
          {trend && trend.verdict !== 'waiting' && (
            <div className={`card trend-read ${trend.verdict}`}>
              <strong>
                {trend.verdict === 'up'
                  ? `Up ${Math.round(trend.diff)} points`
                  : trend.verdict === 'down'
                    ? `Down ${Math.round(-trend.diff)} points`
                    : 'No clear change yet'}
              </strong>
              <span className="small muted">
                {pct(trend.earlier)}% over your first {trend.earlier.attempts} balls, {pct(trend.later)}% over the last{' '}
                {trend.later.attempts}, {SURFACE_LABELS[latest!].toLowerCase()}.{' '}
                {trend.verdict === 'flat'
                  ? `The change is inside the ±${Math.round(trend.margin)} points chance alone moves it.`
                  : `Bigger than the ±${Math.round(trend.margin)} points chance alone moves it.`}
              </span>
            </div>
          )}
          {trend && trend.verdict === 'waiting' && counted! > 0 && (
            <p className="small muted">
              {counted} balls {SURFACE_LABELS[latest!].toLowerCase()} so far, short of the {TREND_NEED * 2} it takes to
              tell a change from noise.
            </p>
          )}
        </>
      )}

      {reads.length > 0 && (
        <>
          <h2>Practice against play</h2>
          <VsPlay reads={reads} />
          {gap && gap.gap! >= 10 && (
            <div className="card gap-card">
              <strong>
                {gap.d} ft has the biggest gap, {Math.round(gap.gap!)} points
              </strong>
              <span className="small muted">
                {pct(gap.practice)}% here against {pct(gap.play)}% when it counts. Practice reads high on a true surface,
                so the number to watch is the gap closing.
              </span>
            </div>
          )}
        </>
      )}

      <div className="btn-row" style={{ marginTop: 22 }}>
        <a className="btn" href={`#/practice/edit/${drill.id}`}>
          Edit
        </a>
        <button className="btn btn-primary" disabled={!usable} onClick={() => setRolling(true)}>
          Roll it
        </button>
      </div>

      {h && (
        <>
          <h2>Every set</h2>
          {[...h.sets].reverse().map((s) => (
            <div key={s.id} className="stat-row">
              <span className="k">
                {fmtDate(s.date)} · {SURFACE_LABELS[s.surface]}
              </span>
              <span className="set-right">
                <span className="v num">{setScore(drill, s)}</span>
                <ConfirmButton
                  label="Delete"
                  confirmLabel="Sure?"
                  className="btn btn-ghost set-del"
                  onConfirm={() => dispatch({ t: 'deletePracticeSet', id: s.id })}
                />
              </span>
            </div>
          ))}
        </>
      )}

      {rolling && <DrillLogger drill={fitted} surface={surface} onClose={() => setRolling(false)} />}
    </div>
  );
}
