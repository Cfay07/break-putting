import { Fragment, useMemo, useState } from 'react';
import { RankedList } from '../components/RoundTrophies';
import { Sheet } from '../components/Sheet';
import { fmtDate } from '../lib/format';
import { go } from '../lib/router';
import { headlineRanks, METRICS, rankedBy, rankText, roundRanks } from '../lib/roundRanks';
import { courseLabel } from '../lib/stats';
import { useApp } from '../lib/store';
import { streaks as streaksOf, type Streak } from '../lib/streaks';
import { trophyRoom, type Trophy } from '../lib/trophies';
import type { Round } from '../lib/types';

const RECENT = 10;

/**
 * The number alone, so every record reads the same: "93% struck in the middle" and "5 birdies"
 * become "93%" and "5". The title says what it counts, and the ranked list it opens has the rest.
 */
function shortValue(v: string): string {
  const m = v.match(/^[+−-]?[\d.,]+(%| ft)?/);
  return m ? m[0] : v;
}

const played = (r: Round) => r.holes.filter((h) => h.putts.length > 0).length;

/**
 * Everything you have done, in one scroll: your record on every number, each one opening as a
 * leaderboard of your own rounds, then what your recent rounds did against them.
 */
export function HistoryPage() {
  const { state } = useApp();
  const [list, setList] = useState<{ key: string; length?: number } | null>(null);

  const rounds = useMemo(() => state.rounds.filter((r) => r.finished && !r.practice && played(r) > 0), [state.rounds]);
  // Runs inside a round. Runs across rounds have their own section.
  const holeRuns = useMemo(
    () => trophyRoom(state.rounds, state.baseline).highs.filter((t) => !t.metric && t.key !== 'high-nothree'),
    [state.rounds, state.baseline],
  );
  const runs = useMemo(
    () =>
      streaksOf(state.rounds, state.baseline)
        .filter((s) => s.current > 0 || s.best >= 3)
        .sort((a, b) => b.current - a.current || b.best - a.best),
    [state.rounds, state.baseline],
  );
  const recent = useMemo(
    () =>
      [...rounds]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, RECENT)
        .map((r) => ({ r, best: headlineRanks(roundRanks(r, state.rounds, state.baseline))[0] ?? null })),
    [rounds, state.rounds, state.baseline],
  );
  const boards = useMemo(() => {
    const out: { key: string; length?: number; title: string; best: string; n: number; where: string }[] = [];
    for (const m of METRICS) {
      const lengths = m.sameLength ? [18, 9] : [undefined];
      for (const length of lengths) {
        const ranked = rankedBy(state.rounds, state.baseline, m.key, length);
        if (!ranked || ranked.rows.length < 3) continue;
        out.push({
          key: m.key,
          length,
          title: length && length !== 18 ? `${m.label}, ${length} holes` : m.label,
          best: ranked.rows[0].value,
          n: ranked.rows.length,
          where: `${fmtDate(ranked.rows[0].round.date)} · ${courseLabel(ranked.rows[0].round).replace(/ \(\d+\)$/, '')}`,
        });
      }
    }
    return out;
  }, [state.rounds, state.baseline]);
  const open = list ? rankedBy(state.rounds, state.baseline, list.key, list.length) : null;

  if (rounds.length < 3) {
    return (
      <>
        <h1 className="page-title">History</h1>
        <p className="small muted">Your records on every number show up after three rounds.</p>
      </>
    );
  }

  const putts = rounds.reduce((a, r) => a + r.holes.reduce((n, h) => n + h.putts.length, 0), 0);
  const first = rounds.reduce((a, r) => (r.date < a ? r.date : a), rounds[0].date);

  return (
    <div className="history">
      <h1 className="page-title">History</h1>
      <p className="small muted" style={{ margin: '2px 0 0' }}>
        {rounds.length} rounds, {putts.toLocaleString('en-US')} putts, since {fmtDate(first)}.
      </p>

      {runs.length > 0 && (
        <>
          <h2>Streaks</h2>
          <p className="small muted" style={{ margin: '-4px 0 10px' }}>
            Rounds in a row, as of your last round. A round with nothing to judge it on is skipped.
          </p>
          <div className="board">
            {runs.map((s) => (
              <StreakRow key={s.key} s={s} first={first} />
            ))}
          </div>
        </>
      )}

      <h2>Records</h2>
      <p className="small muted" style={{ margin: '-4px 0 10px' }}>
        Your best on every number, and where you set it. Tap one for every round ranked on it.
      </p>
      <div className="board">
        {boards.map((b) => (
          <Fragment key={`${b.key}-${b.length ?? 'all'}`}>
            <button className="lb-row record-row" onClick={() => setList({ key: b.key, length: b.length })}>
              <span className="nm">
                {b.title}
                <small>{b.where}</small>
              </span>
              <span className="val num" title={b.best}>
                {shortValue(b.best)}
              </span>
              <span className="chev">›</span>
            </button>
            {b.key === 'longest' && holeRuns.map((t) => <TrophyRow key={t.key} t={t} />)}
          </Fragment>
        ))}
      </div>

      <h2>Your last {recent.length} rounds</h2>
      <div className="board">
        {recent.map(({ r, best }) => (
          <button key={r.id} className="lb-row trophy-row" onClick={() => go(`/round/${r.id}`)}>
            <span className={best && best.rank === 1 && !best.since ? 'trophy-badge gold' : 'trophy-badge'}>
              {best ? (best.since ? '↑' : `${best.tied ? 'T' : '#'}${best.rank}`) : '·'}
            </span>
            <span className="nm">
              {fmtDate(r.date)} · {courseLabel(r)}
              <small>{best ? `${best.label}, ${best.value}. ${rankText(best)}` : 'No records this round'}</small>
            </span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>

      {open && (
        <Sheet
          title={list?.length && list.length !== 18 ? `${open.label}, ${list.length} holes` : open.label}
          onClose={() => setList(null)}
        >
          <RankedList rows={open.rows} onPick={(id) => (setList(null), go(`/round/${id}`))} />
        </Sheet>
      )}
    </div>
  );
}

/** One record: what it is and where it happened, the number on the right. Opens the round. */
function TrophyRow({ t }: { t: Trophy }) {
  return (
    <button className="lb-row record-row" onClick={() => go(`/round/${t.roundId}${t.hole ? `/hole/${t.hole}` : ''}`)}>
      <span className="nm">
        {t.title}
        <small>{t.where}</small>
      </span>
      <span className="val num">{t.value}</span>
      <span className="chev">›</span>
    </button>
  );
}

function StreakRow({ s, first }: { s: Streak; first: string }) {
  const target = s.latest ?? s.bestTo;
  const bestSpan = s.bestFrom && s.bestTo ? `${fmtDate(s.bestFrom.date)} to ${fmtDate(s.bestTo.date)}` : '';
  const sub = s.current
    ? s.current >= s.best
      ? `Since ${fmtDate(s.since!.date)}. Your longest since you started logging on ${fmtDate(first)}.`
      : `Since ${fmtDate(s.since!.date)}. Best ${s.best}, ${bestSpan}.`
    : `Ended ${s.endedOn ? fmtDate(s.endedOn.date) : ''}. Best ${s.best}, ${bestSpan}.`;
  return (
    <button className="lb-row record-row" onClick={() => target && go(`/round/${target.id}`)}>
      <span className="nm">
        {s.label}
        <small>{sub}</small>
      </span>
      <span className={s.current ? 'val num' : 'val num muted'}>{s.current}x</span>
      <span className="chev">›</span>
    </button>
  );
}
