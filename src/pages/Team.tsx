import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { currentSession } from '../lib/cloud';
import {
  createTeam,
  joinTeam,
  leaveTeam,
  loadTeams,
  saveTheme,
  setDisplayName,
  type Member,
  type PlayerStats,
  type Team,
  type TeamView,
} from '../lib/teams';

const EMPTY: TeamView = { teams: [], members: [], stats: [] };

/**
 * Ranked on the six-footer. Putts per round is the obvious choice and it is the wrong one:
 * every golf app already has it, and it rewards missing greens. This is the number only this
 * app knows, so it is the one worth competing on.
 */
const BOARDS = [
  { key: 'make6', label: 'Six-footers', fmt: (v: number) => `${(v * 100).toFixed(0)}%`, high: true },
  { key: 'bleed_recovery', label: 'Bounce back', fmt: (v: number) => `${(v * 100).toFixed(0)}%`, high: true },
  { key: 'sg_pr', label: 'SG', fmt: (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)), high: true },
] as const;

type BoardKey = (typeof BOARDS)[number]['key'];

/** "conor.fayard" is not a name. Turn the email local-part into something presentable. */
function nameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

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
  const rows: [string, string][] = stats
    ? [
        ['Rounds logged', String(stats.rounds)],
        ['Competitive', String(stats.competitive_rounds)],
        ['Putts per round', stats.putts_pr?.toFixed(1) ?? '--'],
        ['3-putts per round', stats.three_pr?.toFixed(2) ?? '--'],
        ['Strokes gained', stats.sg_pr !== null ? stats.sg_pr.toFixed(2) : '--'],
        ['Six-footers', stats.make6 !== null ? `${(stats.make6 * 100).toFixed(0)}%` : '--'],
        [
          'Bounce back',
          stats.bleed_recovery !== null ? `${(stats.bleed_recovery * 100).toFixed(0)}%` : '--',
        ],
        ['Last round', stats.last_round ?? '--'],
      ]
    : [];

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="player-head">
        <Crest name={name} accent={accent} />
        <p className="small muted" style={{ margin: 0 }}>
          {member.role === 'owner' ? 'Team owner' : 'Player'}
        </p>
      </div>

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
          {name} has not logged a round yet, so there is nothing to show. Their numbers appear
          here the first time they finish one.
        </p>
      )}

      <p className="small muted" style={{ marginTop: 10 }}>
        Individual rounds stay private to the player who logged them.
      </p>
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
  const [board, setBoard] = useState<BoardKey>('make6');
  const [open, setOpen] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftAccent, setDraftAccent] = useState('#D01C2E');
  const [myName, setMyName] = useState('');

  const refresh = async () => {
    setLoading(true);
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

  const team: Team | undefined = useMemo(
    () => view.teams.find((t) => t.id === pick) ?? view.teams[0],
    [view.teams, pick],
  );
  const accent = team?.theme?.accent || '#14392b';

  const roster = useMemo(() => {
    if (!team) return [];
    const byUser = new Map(view.stats.map((s) => [s.user_id, s]));
    const rank = BOARDS.find((b) => b.key === board)!;
    return view.members
      .filter((m) => m.team_id === team.id)
      .map((m) => ({ member: m, stats: byUser.get(m.user_id) }))
      .sort((a, b) => {
        const av = a.stats?.[rank.key] ?? null;
        const bv = b.stats?.[rank.key] ?? null;
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return bv - av;
      });
  }, [view, team, board]);

  const me = useMemo(
    () => view.members.find((m) => m.team_id === team?.id && m.user_id === session?.userId),
    [view.members, team?.id, session?.userId],
  );

  useEffect(() => {
    setEditing(false);
    setOpen(null);
    setMyName(me?.display_name ?? '');
  }, [team?.id, me?.display_name]);

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
      <div className="empty">
        <p>Sign in on the Settings tab to use teams.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="empty">
        <p>Loading…</p>
      </div>
    );
  }

  const joinBlock = (
    <>
      <div className="field-label">Join a team</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Six-letter code"
          maxLength={6}
          style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.12em' }}
        />
        <button
          className="btn btn-primary"
          disabled={busy || code.trim().length < 4}
          onClick={() => run(() => joinTeam(code.trim(), nameFromEmail(session.email)))}
          style={{ flex: '0 0 auto' }}
        >
          Join
        </button>
      </div>

      <div className="field-label">Or start one</div>
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
          onClick={() => run(() => createTeam(newName.trim(), nameFromEmail(session.email)))}
          style={{ flex: '0 0 auto' }}
        >
          Create
        </button>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Teams are always private. The code is the only way in, and you can be on as many as you
        like.
      </p>
    </>
  );

  if (!team) {
    return (
      <>
        <h2 style={{ marginTop: 0 }}>Teams</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          A team puts your putting next to the people you actually play with.
        </p>
        {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}
        {joinBlock}
      </>
    );
  }

  const openMember = roster.find((r) => r.member.user_id === open);

  return (
    <div className="team-scope" style={{ '--team': accent } as React.CSSProperties}>
      <div className="team-head">
        <Crest name={team.name} accent={accent} />
        <div style={{ minWidth: 0, flex: 1 }}>
          {view.teams.length > 1 ? (
            <div className="team-switch">
              <h2 style={{ margin: 0, lineHeight: 1.15 }}>{team.name}</h2>
              <select value={team.id} onChange={(e) => setPick(e.target.value)} aria-label="Switch team">
                {view.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <h2 style={{ margin: 0, lineHeight: 1.15 }}>{team.name}</h2>
          )}
          <p className="small muted" style={{ margin: 0 }}>
            {team.theme?.label ? `${team.theme.label} · ` : ''}
            {roster.length} {roster.length === 1 ? 'player' : 'players'}
          </p>
        </div>
        <button
          className="code-chip"
          onClick={() => {
            void navigator.clipboard?.writeText(team.join_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          aria-label={`Copy join code ${team.join_code}`}
        >
          {copied ? 'Copied' : team.join_code}
        </button>
      </div>
      <div className="team-rule" />

      {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}

      <div className="board-bar">
        <span className="field-label" style={{ margin: 0 }}>Leaderboard</span>
        <select
          className="pick"
          value={board}
          onChange={(e) => setBoard(e.target.value as BoardKey)}
          aria-label="Rank by"
        >
          {BOARDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      {roster.map(({ member, stats }, i) => {
        const rank = BOARDS.find((b) => b.key === board)!;
        const v = stats?.[rank.key] ?? null;
        const name = member.display_name ?? 'Unnamed player';
        const ranked = v !== null;
        return (
          <button
            key={member.user_id}
            className={ranked && i === 0 ? 'player-row lead' : 'player-row'}
            onClick={() => setOpen(member.user_id)}
          >
            <span className="place num">{ranked ? i + 1 : ''}</span>
            <span className="who">
              <span className="nm">{name}</span>
              <span className="sub small muted">
                {stats?.live
                  ? `thru ${stats.live.thru}`
                  : stats?.rounds
                    ? `${stats.rounds} round${stats.rounds === 1 ? '' : 's'}`
                    : 'no rounds yet'}
              </span>
            </span>
            {stats?.live && <span className="live-dot" aria-label="playing now" />}
            <span className={ranked ? 'big num' : 'big num none'}>{ranked ? rank.fmt(v) : '--'}</span>
          </button>
        );
      })}

      <p className="small muted" style={{ marginTop: 10 }}>
        Everyone scored against your baseline, so it is like for like.
      </p>

      <details className="manage">
        <summary>Manage</summary>
      {team.owner_id === session.userId && (
        <>
          <div className="field-label">Team page</div>
          {editing ? (
            <>
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
                <span className="small muted">Your colour. Everything else stays on the app's type and paper.</span>
              </div>
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await saveTheme(
                        team.id,
                        { ...team.theme, accent: draftAccent },
                        draftName.trim() || team.name,
                      );
                      setEditing(false);
                    })
                  }
                >
                  Save
                </button>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setDraftName(team.name);
                setDraftAccent(accent);
                setEditing(true);
              }}
            >
              Design this team
            </button>
          )}
        </>
      )}

      <div className="field-label">You</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={myName}
          onChange={(e) => setMyName(e.target.value)}
          placeholder="How your name shows up"
          maxLength={40}
          style={{ flex: 1 }}
        />
        <button
          className="btn"
          disabled={busy || !myName.trim() || myName.trim() === me?.display_name}
          onClick={() => run(() => setDisplayName(team.id, myName))}
          style={{ flex: '0 0 auto' }}
        >
          Save
        </button>
      </div>
      <button
        className="btn btn-ghost btn-danger"
        style={{ marginTop: 10 }}
        disabled={busy}
        onClick={() => run(() => leaveTeam(team.id))}
      >
        Leave {team.name}
      </button>

      <div style={{ marginTop: 18 }}>{joinBlock}</div>
      </details>

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
