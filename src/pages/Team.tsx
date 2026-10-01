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
  { key: 'make6', label: 'Six-footers', fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
  { key: 'bleed_recovery', label: 'Bounce back', fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
  { key: 'sg_pr', label: 'Strokes gained', fmt: (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) },
] as const;

type BoardKey = (typeof BOARDS)[number]['key'];

const NEW_TEAM = '__new';

/** Matches the cap enforced inside join_team. The database is the one that actually holds it. */
const MAX_PLAYERS = 50;

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
        ['Bounce back', stats.bleed_recovery !== null ? `${(stats.bleed_recovery * 100).toFixed(0)}%` : '--'],
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
          {name} has not logged a round yet. Their numbers appear here the first time they finish
          one.
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
  const [sheet, setSheet] = useState<'manage' | 'add' | null>(null);
  const [code, setCode] = useState('');
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState(false);
  const [myName, setMyName] = useState('');
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

  const team: TeamRow | undefined = useMemo(
    () => view.teams.find((t) => t.id === pick) ?? view.teams[0],
    [view.teams, pick],
  );
  const accent = team?.theme?.accent || '#14392b';
  const isOwner = !!team && team.owner_id === session?.userId;

  const me = useMemo(
    () => view.members.find((m) => m.team_id === team?.id && m.user_id === session?.userId),
    [view.members, team?.id, session?.userId],
  );

  // Switching teams drops any half-finished edit. Otherwise the draft name and colour from the
  // team you were looking at carry over and get saved onto the team you switched to.
  useEffect(() => {
    setSheet(null);
    setOpen(null);
    setMyName(me?.display_name ?? '');
    setDraftName(team?.name ?? '');
    setDraftAccent(team?.theme?.accent ?? '#D01C2E');
  }, [team?.id, team?.name, team?.theme?.accent, me?.display_name]);

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
        return bv - av;
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
              const t = await joinTeam(code.trim(), nameFromEmail(session.email));
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
              const t = await createTeam(newName.trim(), nameFromEmail(session.email));
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
        Teams are private and hold up to {MAX_PLAYERS}. The code is the only way in, and you can
        be on as many teams as you like.
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
          <div className="team-switch">
            <h2>{team.name}</h2>
            <select
              value={team.id}
              aria-label="Switch team"
              onChange={(e) => {
                if (e.target.value === NEW_TEAM) setSheet('add');
                else setPick(e.target.value);
              }}
            >
              {view.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value={NEW_TEAM}>Join or start a team…</option>
            </select>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {team.theme?.label ? `${team.theme.label} · ` : ''}
            {roster.length} of {MAX_PLAYERS} players
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

      {sheet === 'add' && (
        <Sheet title="Teams" onClose={() => setSheet(null)}>
          {addForm}
        </Sheet>
      )}

      {sheet === 'manage' && (
        <Sheet title={team.name} onClose={() => setSheet(null)}>
          <div className="field-label" style={{ marginTop: 0 }}>
            Your name on this team
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              maxLength={40}
              placeholder="How you show up"
              style={{ flex: 1 }}
            />
            <button
              className="btn"
              style={{ flex: '0 0 auto' }}
              disabled={busy || !myName.trim() || myName.trim() === me?.display_name}
              onClick={() => run(() => setDisplayName(team.id, myName))}
            >
              Save
            </button>
          </div>

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
