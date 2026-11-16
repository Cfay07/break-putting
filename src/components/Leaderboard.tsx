import { useEffect, useMemo, useState } from 'react';
import { BOARDS, WINDOWS, board as rankBoard, type Window } from '../lib/board';
import type { TeamPracticeRow } from '../lib/feed';
import { loadBoard, type TeamRound } from '../lib/teams';

/**
 * The team, ranked. Pick what to rank on and over how long; the leader gets the big card, every
 * row says what its number stands on, and arrows show who moved since the window before.
 */
export function Leaderboard({
  players,
  me,
  onOpen,
}: {
  players: { id: string; name: string; live: boolean }[];
  me: string;
  onOpen: (user: string) => void;
}) {
  const [data, setData] = useState<{ rounds: TeamRound[]; practice: TeamPracticeRow[] } | null>(null);
  const [err, setErr] = useState('');
  const [key, setKey] = useState(BOARDS[0].key);
  const [win, setWin] = useState<Window>('season');
  const [tournament, setTournament] = useState(false);

  useEffect(() => {
    loadBoard()
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the leaderboard.'));
  }, []);

  const def = BOARDS.find((b) => b.key === key)!;
  const ids = useMemo(() => players.map((p) => p.id), [players]);
  const rows = useMemo(
    () => (data ? rankBoard(def, ids, data.rounds, data.practice, win, tournament && def.kind === 'rounds') : []),
    [data, def, ids, win, tournament],
  );
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? 'A teammate';
  const live = (id: string) => players.find((p) => p.id === id)?.live ?? false;

  const leader = rows[0]?.place === 1 ? rows[0] : null;
  const tiedTop = rows.filter((r) => r.place === 1).length > 1;

  return (
    <section className="lb">
      <div className="lb-boards" role="group" aria-label="Rank by">
        {BOARDS.map((b) => (
          <button key={b.key} className={b.key === key ? 'chip chip-sel' : 'chip'} onClick={() => setKey(b.key)}>
            {b.label}
          </button>
        ))}
      </div>

      <div className="seg seg-quiet lb-windows" role="group" aria-label="Over how long">
        {WINDOWS.map((w) => (
          <button key={w.key} aria-pressed={win === w.key} onClick={() => setWin(w.key)}>
            {w.label}
          </button>
        ))}
      </div>
      {def.kind === 'rounds' && (
        <label className="lb-toggle">
          <input type="checkbox" checked={tournament} onChange={(e) => setTournament(e.target.checked)} />
          Tournament rounds only
        </label>
      )}

      {err && <p className="small neg">{err}</p>}
      {!data && !err && <p className="small muted">Loading the leaderboard…</p>}

      {data && leader && leader.value && (
        <button className="lb-leader" onClick={() => onOpen(leader.user)}>
          <span className="lb-leader-k">{tiedTop ? 'Tied for the lead' : 'Leads the team'}</span>
          <span className="lb-leader-name">
            {leader.user === me ? 'You' : name(leader.user)}
            {live(leader.user) && <span className="live-dot" aria-label="playing now" />}
          </span>
          <span className="lb-leader-v num">{def.fmt(leader.value.v)}</span>
          <span className="lb-leader-n">{leader.value.n}</span>
        </button>
      )}

      {data && (
        <div className="board">
          {rows.map((r) => (
            <button
              key={r.user}
              className={`lb-row${r.user === me ? ' me' : ''}${r.place === 1 ? ' lead' : ''}`}
              onClick={() => onOpen(r.user)}
            >
              <span className="place num">
                {r.place === null ? '' : rows.filter((x) => x.place === r.place).length > 1 ? `T${r.place}` : r.place}
              </span>
              <span className="lb-move">
                {r.moved === null || r.moved === 0 ? (
                  ''
                ) : r.moved > 0 ? (
                  <span className="up">▲{r.moved}</span>
                ) : (
                  <span className="down">▼{-r.moved}</span>
                )}
              </span>
              <span className="nm">
                {name(r.user)}
                {live(r.user) && <span className="live-dot" aria-label="playing now" />}
                <small>
                  {r.value
                    ? r.value.n
                    : r.empty
                      ? def.kind === 'rounds'
                        ? 'no rounds'
                        : 'no practice'
                      : def.kind === 'practice'
                        ? 'no tests yet'
                        : 'not enough to rank yet'}
                </small>
              </span>
              <span className={r.value ? 'val num' : 'val num none'}>{r.value ? def.fmt(r.value.v) : '--'}</span>
            </button>
          ))}
        </div>
      )}
      {data && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {def.says} {win === 'season' ? 'Since August 1.' : win === 'all' ? 'Every round shared.' : ''}
          {(win === 'week' || win === 'month') && ' Arrows are places moved since the window before.'}
          {def.kind === 'rounds' && ' Rates need nine holes, make rates eight putts from that range.'}
        </p>
      )}
    </section>
  );
}
