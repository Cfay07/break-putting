import { currentSession, online, table } from './cloud';

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
  bleed_recovery: number | null;
  last_round: string | null;
  live: { hole: number; thru: number; course?: string; started_at: string } | null;
  updated_at?: string;
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
  const teams = await rows<Team>('teams?select=id,name,join_code,owner_id,theme');
  if (!teams.length) return { teams: [], members: [], stats: [] };
  const [members, stats] = await Promise.all([
    rows<Member>('team_members?select=team_id,user_id,display_name,role'),
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

export async function setDisplayName(teamId: string, name: string): Promise<void> {
  const session = currentSession();
  if (!session) return;
  await table(`team_members?team_id=eq.${teamId}&user_id=eq.${session.userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ display_name: name.trim() || null }),
  });
}

/** Publish my own summary. Fire and forget: a failed publish is not worth an error on screen. */
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
