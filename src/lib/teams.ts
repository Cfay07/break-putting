import { currentSession, online, saveAccountName, table } from './cloud';

export interface TeamTheme {
  accent?: string;
  ink?: string;
  label?: string;
}

export interface Team {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
  theme: TeamTheme;
}

export interface Member {
  team_id: string;
  user_id: string;
  display_name: string | null;
  role: 'owner' | 'member';
  /** The team this player lands on. At most one of their rows carries it. */
  starred: boolean;
}

/** What a player publishes about themselves. Raw rounds never leave their owner. */
export interface PlayerStats {
  user_id: string;
  rounds: number;
  competitive_rounds: number;
  putts_pr: number | null;
  three_pr: number | null;
  sg_pr: number | null;
  make6: number | null;
  /** Shots dropped per round after a putting mistake. Lower is better. */
  bleed_pr: number | null;
  /** Par or better on the hole right after a mistake. Higher is better. */
  bounce_back: number | null;
  /** Make rate from 3 to 10 feet. */
  scoring_pct: number | null;
  last_round: string | null;
  live: { hole: number; thru: number; course?: string; started_at: string } | null;
  updated_at?: string;
}

/** A scorecard line a teammate can see. The putt-by-putt detail stays with its owner. */
export interface TeamRound {
  user_id: string;
  round_id: string;
  played_on: string | null;
  course: string | null;
  holes_played: number | null;
  score: number | null;
  putts: number | null;
  three_putts: number | null;
  sg: number | null;
  competitive: boolean;
  /** Per hole: h hole, p putts, d first putt distance, v strokes against par. */
  detail: { h: number; p: number; d: number | null; v: number | null }[] | null;
}

export interface TeamView {
  teams: Team[];
  members: Member[];
  stats: PlayerStats[];
}

async function rpc<T>(fn: string, args: unknown): Promise<T> {
  const res = await table(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `That did not work (${res.status}).`);
  }
  return (await res.json()) as T;
}

async function rows<T>(path: string): Promise<T[]> {
  const res = await table(path);
  if (!res.ok) throw new Error(`Could not load (${res.status}).`);
  return (await res.json()) as T[];
}

export async function loadTeams(): Promise<TeamView> {
  if (!currentSession() || !online()) return { teams: [], members: [], stats: [] };
  const teams = await rows<Team>(
    'teams?select=id,name,join_code,owner_id,theme&order=created_at.asc',
  );
  if (!teams.length) return { teams: [], members: [], stats: [] };
  const [members, stats] = await Promise.all([
    rows<Member>('team_members?select=team_id,user_id,display_name,role,starred'),
    rows<PlayerStats>('team_stats?select=*'),
  ]);
  return { teams, members, stats };
}

export function createTeam(name: string, display?: string): Promise<Team> {
  return rpc<Team>('create_team', { team_name: name, display: display ?? null });
}

export function joinTeam(code: string, display?: string): Promise<Team> {
  return rpc<Team>('join_team', { code, display: display ?? null });
}

export async function leaveTeam(teamId: string): Promise<void> {
  const session = currentSession();
  if (!session) throw new Error('Not signed in.');
  const res = await table(`team_members?team_id=eq.${teamId}&user_id=eq.${session.userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Could not leave (${res.status}).`);
}

export async function saveTheme(teamId: string, theme: TeamTheme, name?: string): Promise<void> {
  const patch: Record<string, unknown> = { theme };
  if (name !== undefined) patch.name = name;
  const res = await table(`teams?id=eq.${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Could not save (${res.status}).`);
}

/**
 * One name for the account, not one per team. It is saved on the auth user so a new phone picks
 * it up, then copied onto every roster row because that is the only copy a teammate can read.
 */
export async function setDisplayName(name: string): Promise<void> {
  const session = currentSession();
  if (!session) return;
  const clean = name.trim();
  await saveAccountName(clean);
  const res = await table(`team_members?user_id=eq.${session.userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ display_name: clean || null }),
  });
  if (!res.ok) throw new Error(`Could not save your name (${res.status}).`);
}

/** Star one team and clear the rest, so exactly one is the landing team. */
export async function starTeam(teamId: string): Promise<void> {
  const session = currentSession();
  if (!session) throw new Error('Not signed in.');
  const clear = await table(`team_members?user_id=eq.${session.userId}&team_id=neq.${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify({ starred: false }),
  });
  if (!clear.ok) throw new Error(`Could not save (${clear.status}).`);
  const set = await table(`team_members?user_id=eq.${session.userId}&team_id=eq.${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify({ starred: true }),
  });
  if (!set.ok) throw new Error(`Could not save (${set.status}).`);
}

/** Publish my own summary. Fire and forget: a failed publish is not worth an error on screen. */
/** Round list for one player, newest first. */
export async function loadPlayerRounds(userId: string): Promise<TeamRound[]> {
  return rows<TeamRound>(
    `team_rounds?select=*&user_id=eq.${userId}&order=played_on.desc&limit=40`,
  );
}

export async function publishRounds(mine: Omit<TeamRound, 'user_id'>[]): Promise<void> {
  const session = currentSession();
  if (!session || !online() || !mine.length) return;
  try {
    await table('team_rounds?on_conflict=user_id,round_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(
        mine.map((r) => ({ user_id: session.userId, ...r, updated_at: new Date().toISOString() })),
      ),
    });
  } catch {
    // next open will try again
  }
}

/**
 * Deleting a round took it off the phone and out of `rounds`, but the copy published for the
 * team was never touched, so teammates kept seeing a round its owner could not. Tombstones are
 * the same signal the round sync already uses, and the delete is idempotent, so resending the
 * recent ones costs nothing and heals a device that was offline when the deletion happened.
 */
export async function unpublishRounds(ids: string[]): Promise<void> {
  const session = currentSession();
  if (!session || !online() || !ids.length) return;
  try {
    const list = ids.map((id) => `"${id}"`).join(',');
    await table(`team_rounds?user_id=eq.${session.userId}&round_id=in.(${list})`, {
      method: 'DELETE',
    });
  } catch {
    // next open will try again
  }
}

export async function publishStats(mine: Omit<PlayerStats, 'user_id'>): Promise<void> {
  const session = currentSession();
  if (!session || !online()) return;
  try {
    await table('team_stats?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ user_id: session.userId, ...mine, updated_at: new Date().toISOString() }]),
    });
  } catch {
    // next open will try again
  }
}
