import { useMemo, useState } from 'react';
import { RankedList } from '../components/RoundTrophies';
import { Sheet } from '../components/Sheet';
import { fmtDate } from '../lib/format';
import { go } from '../lib/router';
import { headlineRanks, METRICS, rankedBy, rankText, roundRanks } from '../lib/roundRanks';
import { courseLabel } from '../lib/stats';
import { useApp } from '../lib/store';
import { trophyRoom, type Trophy } from '../lib/trophies';
import type { Round } from '../lib/types';

const RECENT = 10;

const played = (r: Round) => r.holes.filter((h) => h.putts.length > 0).length;

/**
 * Everything you have done, in one scroll: the records you hold, the ones you would rather not,
 * what each recent round did to them, and a leaderboard of your own rounds for every number.
 */
export function HistoryPage() {
  const { state } = useApp();
  const [list, setList] = useState<{ key: string; length?: number } | null>(null);

  const rounds = useMemo(() => state.rounds.filter((r) => r.finished && !r.practice && played(r) > 0), [state.rounds]);
  const room = useMemo(() => trophyRoom(state.rounds, state.baseline), [state.rounds, state.baseline]);
  const recent = useMemo(
    () =>
      [...rounds]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, RECENT)
        .map((r) => ({ r, best: headlineRanks(roundRanks(r, state.rounds, state.baseline))[0] ?? null })),
    [rounds, state.rounds, state.baseline],
  );
  const boards = useMemo(() => {
    const out: { key: string; length?: number; title: string; best: string; n: number }[] = [];
    for (const m of METRICS) {
      const lengths = m.sameLength ? [18, 9] : [undefined];
      for (const length of lengths) {
        const ranked = rankedBy(state.rounds, state.baseline, m.key, length);
        if (!ranked || ranked.rows.length < 3) continue;
        out.push({
          key: m.key,
          length,
          title: length ? `${m.label}, ${length} holes` : m.label,
          best: ranked.rows[0].value,
          n: ranked.rows.length,
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
        <p className="small muted">
          Your records, your worst days and a leaderboard for every number show up after three rounds.
        </p>
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

      <h2>Records you hold</h2>
      <div className="trophy-grid">
        {room.highs.map((t) => (
          <TrophyCard key={t.key} t={t} onList={(key, length) => setList({ key, length })} />
        ))}
      </div>

      <h2>The ones to beat</h2>
      <p className="small muted" style={{ margin: '-4px 0 10px' }}>
        Your worst. Every one of these is a round you can open.
      </p>
      <div className="trophy-grid low">
        {room.lows.map((t) => (
          <TrophyCard key={t.key} t={t} onList={(key, length) => setList({ key, length })} />
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

      <h2>Leaderboards</h2>
      <p className="small muted" style={{ margin: '-4px 0 10px' }}>
        Every round you have logged, ranked on one number. Your best is on the right.
      </p>
      <div className="board">
        {boards.map((b) => (
          <button
            key={`${b.key}-${b.length ?? 'all'}`}
            className="lb-row"
            onClick={() => setList({ key: b.key, length: b.length })}
          >
            <span className="nm">
              {b.title}
              <small>{b.n} rounds</small>
            </span>
            <span className="val num">{b.best}</span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>

      {open && (
        <Sheet title={list?.length ? `${open.label}, ${list.length} holes` : open.label} onClose={() => setList(null)}>
          <RankedList rows={open.rows} onPick={(id) => (setList(null), go(`/round/${id}`))} />
        </Sheet>
      )}
    </div>
  );
}

function TrophyCard({ t, onList }: { t: Trophy; onList: (key: string, length?: number) => void }) {
  return (
    <div className="trophy-card">
      <button className="trophy-open" onClick={() => go(`/round/${t.roundId}${t.hole ? `/hole/${t.hole}` : ''}`)}>
        <span className="trophy-title">{t.title}</span>
        <strong className="num">{t.value}</strong>
        <span className="trophy-where">{t.where}</span>
      </button>
      {t.metric && (
        <button className="trophy-list" onClick={() => onList(t.metric!, t.length)}>
          Full list ›
        </button>
      )}
    </div>
  );
}
