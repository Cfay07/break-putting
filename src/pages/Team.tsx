import { useEffect, useMemo, useState } from 'react';
import { NameField } from '../components/NameField';
import { Sheet } from '../components/Sheet';
import { accountName, currentSession } from '../lib/cloud';
import { fmtDate } from '../lib/format';
import {
  createTeam,
  joinTeam,
  leaveTeam,
  loadTeams,
  saveTheme,
  loadPlayerRounds,
  starTeam,
  type TeamRound,
  type Member,
  type PlayerStats,
  type Team as TeamRow,
  type TeamView,
} from '../lib/teams';

const EMPTY: TeamView = { teams: [], members: [], stats: [] };

/**
 * Ranked on the six-footer. Putts per round is the obvious choice and it is the wrong one:
 * every golf app already has it, and it rewards missing greens. These are numbers only this
 * app knows, so they are the ones worth competing on.
 */
const BOARDS = [
  { key: 'sg_pr', label: 'Strokes gained', fmt: (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)), lowBetter: false },
  { key: 'scoring_pct', label: 'Make % (3-10 ft)', fmt: (v: number) => `${(v * 100).toFixed(0)}%`, lowBetter: false },
  { key: 'make6', label: 'Six-footers', fmt: (v: number) => `${(v * 100).toFixed(0)}%`, lowBetter: false },
  { key: 'three_pr', label: '3-putts per round', fmt: (v: number) => v.toFixed(2), lowBetter: true },
  { key: 'bleed_pr', label: 'Bleed', fmt: (v: number) => `-${v.toFixed(2)}`, lowBetter: true },
  { key: 'bounce_back', label: 'Bounce back', fmt: (v: number) => `${(v * 100).toFixed(0)}%`, lowBetter: false },
] as const;

type BoardKey = (typeof BOARDS)[number]['key'];

/** Matches the cap enforced inside join_team. The database is the one that actually holds it. */
const MAX_PLAYERS = 50;

/** Matches the cap in create_team and join_team. */
const MAX_TEAMS = 5;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function Crest({ name, accent }: { name: string; accent: string }) {
  return (
    <span className="crest" style={{ background: accent }}>
      {initials(name)}
    </span>
  );
}

function RoundCard({ round, onClose }: { round: TeamRound; onClose: () => void }) {
  const holes = round.detail ?? [];
  const title = `${round.played_on ? fmtDate(round.played_on) : 'Round'}${round.course ? ` · ${round.course}` : ''}`;
  const worst = holes.filter((h) => h.p >= 3).map((h) => h.h);

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="card">
        <div className="stat-row">
          <span className="k">Putts</span>
          <span className="v num">{round.putts ?? '--'}</span>
        </div>
        <div className="stat-row">
          <span className="k">3-putts</span>
          <span className={round.three_putts ? 'v num neg' : 'v num'}>{round.three_putts ?? '--'}</span>
        </div>
        <div className="stat-row">
          <span className="k">Strokes gained</span>
          <span className={(round.sg ?? 0) < 0 ? 'v num neg' : 'v num pos'}>
            {round.sg === null ? '--' : round.sg >= 0 ? `+${round.sg.toFixed(2)}` : round.sg.toFixed(2)}
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Score</span>
          <span className="v num">{round.score ?? '--'}</span>
        </div>
      </div>

      {holes.length > 0 ? (
        <>
          <div className="field-label">Hole by hole</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hole</th>
                  <th>First putt</th>
                  <th>Putts</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {holes.map((h) => (
                  <tr key={h.h}>
                    <td>{h.h}</td>
                    <td className="num">{h.d === null ? '--' : `${h.d} ft`}</td>
                    <td className={h.p >= 3 ? 'num neg' : 'num'}>{h.p || '--'}</td>
                    <td className="num">{h.v === null ? '--' : h.v === 0 ? 'E' : h.v > 0 ? `+${h.v}` : h.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {worst.length
              ? `Three-putts on ${worst.length === 1 ? 'hole' : 'holes'} ${worst.join(', ')}.`
              : 'No three-putts in this round.'}
          </p>
        </>
      ) : (
        <p className="small muted">
          This round was logged before hole detail was shared. It appears on their next round.
        </p>
      )}
    </Sheet>
  );
}

function PlayerPanel({
  member,
  stats,
  accent,
  onClose,
}: {
  member: Member;
  stats: PlayerStats | undefined;
  accent: string;
  onClose: () => void;
}) {
  const name = member.display_name ?? 'Unnamed player';
  const [rounds, setRounds] = useState<TeamRound[] | null>(null);
  const [openRound, setOpenRound] = useState<TeamRound | null>(null);

  useEffect(() => {
    let live = true;
    void loadPlayerRounds(member.user_id)
      .then((r) => live && setRounds(r))
      .catch(() => live && setRounds([]));
    return () => {
      live = false;
    };
  }, [member.user_id]);
  const rows: [string, string][] = stats
    ? [
        ['Rounds logged', String(stats.rounds)],
        ['Putts per round', stats.putts_pr?.toFixed(1) ?? '--'],
        ['3-putts per round', stats.three_pr?.toFixed(2) ?? '--'],
        ['Strokes gained', stats.sg_pr !== null ? stats.sg_pr.toFixed(2) : '--'],
        ['Make % from 3 to 10 ft', stats.scoring_pct !== null ? `${(stats.scoring_pct * 100).toFixed(0)}%` : '--'],
        ['Six-footers', stats.make6 !== null ? `${(stats.make6 * 100).toFixed(0)}%` : '--'],
        ['Bleed, shots a round', stats.bleed_pr !== null ? `-${stats.bleed_pr.toFixed(2)}` : '--'],
        ['Bounce back', stats.bounce_back !== null ? `${(stats.bounce_back * 100).toFixed(0)}%` : '--'],
        ['Last round', stats.last_round ? fmtDate(stats.last_round) : '--'],
      ]
    : [];

  return (
    <Sheet title={name} onClose={onClose}>
      {/* Everyone on the board is a player, so saying so is filler. Owner is the only role
          worth printing, and the numbers start right away for everybody else. */}
      {member.role === 'owner' && (
        <p className="small muted" style={{ margin: '0 0 10px' }}>
          Team owner
        </p>
      )}

      {stats?.live && (
        <p className="small" style={{ margin: '0 0 10px', color: accent, fontWeight: 600 }}>
          Out right now · hole {stats.live.hole}, {stats.live.thru} played
          {stats.live.course ? ` · ${stats.live.course}` : ''}
        </p>
      )}

      {stats ? (
        <div className="card">
          {rows.map(([k, v]) => (
            <div className="stat-row" key={k}>
              <span className="k">{k}</span>
              <span className="v num">{v}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="small muted">
          {name} has not logged a round yet. Their numbers appear here the first time they finish
          one.
        </p>
      )}

      {!!rounds?.length && (
        <>
          <div className="field-label">Rounds</div>
          <div className="board">
            {rounds.map((r) => (
              <button
                key={r.round_id}
                className={r.competitive ? 'lb-row comp' : 'lb-row'}
                onClick={() => setOpenRound(r)}
              >
                <span className="nm">
                  {r.played_on ? fmtDate(r.played_on) : '--'}
                  {r.course ? <span className="small muted"> · {r.course}</span> : ''}
                </span>
                <span className="val num">{r.putts ?? '--'}</span>
                <span className={(r.sg ?? 0) < 0 ? 'val num neg' : 'val num pos'}>
                  {r.sg === null ? '--' : r.sg >= 0 ? `+${r.sg.toFixed(2)}` : r.sg.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            Putts and strokes gained per round. Tap one to see the card.
          </p>
        </>
      )}
      {rounds !== null && !rounds.length && (
        <p className="small muted" style={{ marginTop: 10 }}>
          No rounds published yet.
        </p>
      )}

      {openRound && <RoundCard round={openRound} onClose={() => setOpenRound(null)} />}
    </Sheet>
  );
}

export function Team() {
  const session = currentSession();
  const [view, setView] = useState<TeamView>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState('');
  const [board, setBoard] = useState<BoardKey>('sg_pr');
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'manage' | 'add' | 'teams' | 'board' | null>(null);
  const [code, setCode] = useState('');
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftAccent, setDraftAccent] = useState('#D01C2E');

  const refresh = async () => {
    try {
      setView(await loadTeams());
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load your teams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) void refresh();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const starredId = useMemo(
    () => view.members.find((m) => m.user_id === session?.userId && m.starred)?.team_id,
    [view.members, session?.userId],
  );

  const team: TeamRow | undefined = useMemo(
    () =>
      view.teams.find((t) => t.id === pick) ??
      view.teams.find((t) => t.id === starredId) ??
      view.teams[0],
    [view.teams, pick, starredId],
  );
  const accent = team?.theme?.accent || '#14392b';
  const isOwner = !!team && team.owner_id === session?.userId;

  // Pin the selection once a team resolves. Leaving `pick` empty meant the page always showed
  // whatever the server listed first, which is not stable across writes.
  useEffect(() => {
    if (team && !pick) setPick(team.id);
  }, [team, pick]);

  // Switching teams drops any half-finished edit. Otherwise the draft name and colour from the
  // team you were looking at carry over and get saved onto the team you switched to.
  useEffect(() => {
    setSheet(null);
    setOpen(null);
    setDraftName(team?.name ?? '');
    setDraftAccent(team?.theme?.accent ?? '#D01C2E');
  }, [team?.id, team?.name, team?.theme?.accent]);

  const roster = useMemo(() => {
    if (!team) return [];
    const byUser = new Map(view.stats.map((s) => [s.user_id, s]));
    return view.members
      .filter((m) => m.team_id === team.id)
      .map((m) => ({ member: m, stats: byUser.get(m.user_id) }))
      .sort((a, b) => {
        const av = a.stats?.[board] ?? null;
        const bv = b.stats?.[board] ?? null;
        // Players with nothing logged sit at the bottom in name order rather than in whatever
        // order the database happened to return them.
        if (av === null && bv === null)
          return (a.member.display_name ?? '').localeCompare(b.member.display_name ?? '');
        if (av === null) return 1;
        if (bv === null) return -1;
        return BOARDS.find((x) => x.key === board)!.lowBetter ? av - bv : bv - av;
      });
  }, [view, team, board]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <>
        <h2 style={{ marginTop: 0 }}>Teams</h2>
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          A team puts your putting next to the people you actually play with: who holes the most
          six-footers, who stops the bleeding after a three-putt, who is out on the course right
          now. Teams are private and you join with a code.
        </p>
        <a className="btn btn-primary btn-wide" href="#/settings" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Set up an account to join
        </a>
      </>
    );
  }
  if (loading) {
    return (
      <div className="empty">
        <p>Loading…</p>
      </div>
    );
  }

  const addForm = (
    <>
      <div className="field-label" style={{ marginTop: 0 }}>
        Join with a code
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Six letters"
          maxLength={6}
          style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.12em' }}
        />
        <button
          className="btn btn-primary"
          disabled={busy || code.trim().length < 4}
          style={{ flex: '0 0 auto' }}
          onClick={() =>
            run(async () => {
              const t = await joinTeam(code.trim(), accountName());
              setCode('');
              setPick(t.id);
              setSheet(null);
            })
          }
        >
          Join
        </button>
      </div>

      <div className="field-label">Or start your own</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Team name"
          maxLength={60}
          style={{ flex: 1 }}
        />
        <button
          className="btn"
          disabled={busy || !newName.trim()}
          style={{ flex: '0 0 auto' }}
          onClick={() =>
            run(async () => {
              const t = await createTeam(newName.trim(), accountName());
              setNewName('');
              setPick(t.id);
              setSheet(null);
            })
          }
        >
          Create
        </button>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Teams are private and hold up to {MAX_PLAYERS} players. The code is the only way in, and
        you can be on {MAX_TEAMS} teams at once.
      </p>
    </>
  );

  if (!team) {
    return (
      <>
        <h2 style={{ marginTop: 0 }}>Teams</h2>
        <p className="small muted" style={{ margin: '0 0 4px' }}>
          Put your putting next to the people you actually play with.
        </p>
        {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}
        {addForm}
      </>
    );
  }

  const openMember = roster.find((r) => r.member.user_id === open);
  const rank = BOARDS.find((b) => b.key === board)!;

  return (
    <div className="team-scope" style={{ '--team': accent } as React.CSSProperties}>
      <div className="team-head">
        <Crest name={team.name} accent={accent} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <button className="team-switch" onClick={() => setSheet('teams')}>
            <h2>{team.name}</h2>
          </button>
          <p className="small muted" style={{ margin: 0 }}>
            {team.theme?.label ? `${team.theme.label} · ` : ''}
            {roster.length} {roster.length === 1 ? 'player' : 'players'}
          </p>
        </div>
        <button className="icon-btn" onClick={() => setSheet('manage')} aria-label="Team options">
          ⋯
        </button>
      </div>
      <div className="team-rule" />

      {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}

      <div className="board-bar">
        <span className="field-label" style={{ margin: 0 }}>
          Leaderboard
        </span>
        <button className="pick" onClick={() => setSheet('board')}>
          {BOARDS.find((b) => b.key === board)!.label}
        </button>
      </div>

      <div className="board">
        {roster.map(({ member, stats }, i) => {
          const v = stats?.[board] ?? null;
          const ranked = v !== null;
          const mine = member.user_id === session.userId;
          const name = member.display_name ?? 'Unnamed player';
          return (
            <button
              key={member.user_id}
              className={`lb-row${mine ? ' me' : ''}${ranked && i === 0 ? ' lead' : ''}`}
              onClick={() => setOpen(member.user_id)}
            >
              <span className="place num">{ranked ? i + 1 : ''}</span>
              <span className="nm">{name}</span>
              {stats?.live && <span className="live-dot" aria-label="playing now" />}
              <span className={ranked ? 'val num' : 'val num none'}>{ranked ? rank.fmt(v) : '--'}</span>
            </button>
          );
        })}
      </div>

      <p className="small muted" style={{ marginTop: 10 }}>
        Everyone scored against your baseline, so it is like for like. Tap a player for their full
        numbers.
      </p>

      {sheet === 'teams' && (
        <Sheet title="Your teams" onClose={() => setSheet(null)}>
          <p className="small muted" style={{ margin: '0 0 8px' }}>
            The starred team is the one this tab opens on.
          </p>
          <div className="menu">
            {view.teams.map((t) => (
              <div className="menu-pair" key={t.id}>
                <button
                  aria-current={t.id === team.id}
                  onClick={() => {
                    setPick(t.id);
                    setSheet(null);
                  }}
                >
                  <span className="menu-row">
                    <Crest name={t.name} accent={t.theme?.accent || '#14392b'} />
                    {t.name}
                  </span>
                </button>
                <button
                  className={t.id === starredId ? 'star on' : 'star'}
                  disabled={busy}
                  aria-pressed={t.id === starredId}
                  aria-label={t.id === starredId ? `${t.name} is your main team` : `Make ${t.name} your main team`}
                  onClick={() => run(() => starTeam(t.id))}
                >
                  ★
                </button>
              </div>
            ))}
            {view.teams.length < MAX_TEAMS && (
              <>
                <div className="menu-sep" />
                <button onClick={() => setSheet('add')}>
                  <span className="menu-row">Join or start a team</span>
                </button>
              </>
            )}
          </div>
        </Sheet>
      )}

      {sheet === 'board' && (
        <Sheet title="Rank by" onClose={() => setSheet(null)}>
          <div className="menu">
            {BOARDS.map((b) => (
              <button
                key={b.key}
                aria-current={b.key === board}
                onClick={() => {
                  setBoard(b.key);
                  setSheet(null);
                }}
              >
                <span className="menu-row">{b.label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'add' && (
        <Sheet title="Teams" onClose={() => setSheet(null)}>
          {addForm}
        </Sheet>
      )}

      {sheet === 'manage' && (
        <Sheet title={team.name} onClose={() => setSheet(null)}>
          <NameField onSaved={refresh} first />

          <div className="field-label">Join code</div>
          <button
            className="code-chip wide"
            onClick={() => {
              void navigator.clipboard?.writeText(team.join_code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
          >
            {copied ? 'Copied' : `${team.join_code} · tap to copy`}
          </button>

          {isOwner && (
            <>
              <div className="field-label">Team page</div>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                maxLength={60}
                placeholder="Team name"
              />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <input
                  type="color"
                  value={draftAccent}
                  onChange={(e) => setDraftAccent(e.target.value)}
                  aria-label="Team colour"
                  style={{ width: 52, height: 40, padding: 2 }}
                />
                <span className="small muted">Your colour. Type and paper stay the app's.</span>
              </div>
              <button
                className="btn btn-primary btn-wide"
                style={{ marginTop: 10 }}
                disabled={busy || !draftName.trim()}
                onClick={() =>
                  run(async () => {
                    await saveTheme(team.id, { ...team.theme, accent: draftAccent }, draftName.trim());
                    setSheet(null);
                  })
                }
              >
                Save team page
              </button>
            </>
          )}

          <div className="field-label">Leave</div>
          <button
            className="btn btn-ghost btn-danger btn-wide"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await leaveTeam(team.id);
                setPick('');
                setSheet(null);
              })
            }
          >
            Leave {team.name}
          </button>
        </Sheet>
      )}

      {openMember && (
        <PlayerPanel
          member={openMember.member}
          stats={openMember.stats}
          accent={accent}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
