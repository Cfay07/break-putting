import type { Reaction, TeamPracticeRow } from './feed';
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
  role: 'owner' | 'member' | 'coach';
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
  live: {
    hole: number;
    thru: number;
    course?: string;
    started_at: string;
    /** So far, and where it is heading. Older app versions publish neither. */
    putts?: number;
    to_par?: number | null;
    proj?: { putts: number; toPar: number | null; score: number | null } | null;
    holes?: NonNullable<TeamRound['detail']>;
  } | null;
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

export interface TeamPlan {
  team_id: string;
  paid_until: string;
  note: string;
}

export interface TeamView {
  teams: Team[];
  members: Member[];
  stats: PlayerStats[];
  plans: TeamPlan[];
}

/** A plan runs through the end of its last day. */
export const planActive = (plan: TeamPlan | undefined, today: string) => !!plan && plan.paid_until >= today;

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
  if (!currentSession() || !online()) return { teams: [], members: [], stats: [], plans: [] };
  const teams = await rows<Team>('teams?select=id,name,join_code,owner_id,theme&order=created_at.asc');
  rememberOnTeam(teams.length > 0);
  if (!teams.length) return { teams: [], members: [], stats: [], plans: [] };
  const [members, stats, plans] = await Promise.all([
    rows<Member>('team_members?select=team_id,user_id,display_name,role,starred'),
    rows<PlayerStats>('team_stats?select=*'),
    rows<TeamPlan>('team_plans?select=team_id,paid_until,note'),
  ]);
  return { teams, members, stats, plans };
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
  return rows<TeamRound>(`team_rounds?select=*&user_id=eq.${userId}&order=played_on.desc&limit=40`);
}

export async function publishRounds(mine: Omit<TeamRound, 'user_id'>[]): Promise<void> {
  const session = currentSession();
  if (!session || !online() || !mine.length) return;
  try {
    await table('team_rounds?on_conflict=user_id,round_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(mine.map((r) => ({ user_id: session.userId, ...r, updated_at: new Date().toISOString() }))),
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

/** My practice, for the team feed. Fire and forget, like the rounds. */
export async function publishPractice(mine: Omit<TeamPracticeRow, 'user_id'>[]): Promise<void> {
  const session = currentSession();
  if (!session || !online() || !mine.length) return;
  try {
    await table('team_practice?on_conflict=user_id,set_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(mine.map((p) => ({ user_id: session.userId, ...p, updated_at: new Date().toISOString() }))),
    });
  } catch {
    // next open will try again
  }
}

/** Everything the feed is made of. Row security already limits each table to me and my teammates. */
export async function loadFeed(): Promise<{ rounds: TeamRound[]; practice: TeamPracticeRow[]; reactions: Reaction[] }> {
  if (!currentSession() || !online()) return { rounds: [], practice: [], reactions: [] };
  const [rounds, practice, reactions] = await Promise.all([
    rows<TeamRound>('team_rounds?select=*&order=played_on.desc&limit=60'),
    rows<TeamPracticeRow>(
      'team_practice?select=user_id,set_id,played_on,title,kind,made,attempts&order=played_on.desc&limit=200',
    ),
    rows<Reaction>('team_reactions?select=post,user_id'),
  ]);
  return { rounds, practice, reactions };
}

export async function setReaction(post: string, on: boolean): Promise<void> {
  const session = currentSession();
  if (!session) throw new Error('Not signed in.');
  const res = on
    ? await table('team_reactions', { method: 'POST', body: JSON.stringify([{ post, user_id: session.userId }]) })
    : await table(`team_reactions?post=eq.${encodeURIComponent(post)}&user_id=eq.${session.userId}`, {
        method: 'DELETE',
      });
  if (!res.ok) throw new Error(`Could not save that (${res.status}).`);
}

export async function unpublishPractice(ids: string[]): Promise<void> {
  const session = currentSession();
  if (!session || !online() || !ids.length) return;
  try {
    const list = ids.map((id) => `"${id}"`).join(',');
    await table(`team_practice?user_id=eq.${session.userId}&set_id=in.(${list})`, { method: 'DELETE' });
  } catch {
    // next open will try again
  }
}

/** Remembered so the Team tab shows on the next open without waiting on the network. */
const ON_TEAM = 'break.onTeam';

export function onTeamCached(): boolean {
  try {
    return localStorage.getItem(ON_TEAM) === '1';
  } catch {
    return false;
  }
}

export function rememberOnTeam(on: boolean) {
  try {
    if (on) localStorage.setItem(ON_TEAM, '1');
    else localStorage.removeItem(ON_TEAM);
    window.dispatchEvent(new Event('break:team'));
  } catch {
    // Private mode: the tab shows once the Team page has loaded this session.
  }
}

export interface Focus {
  team_id: string;
  session: string;
  set_at: string;
}

/** Four months, so a coach opening this over the winter still sees the fall season's leak. */
export async function loadCoach(teamId: string): Promise<{
  rounds: TeamRound[];
  practice: TeamPracticeRow[];
  focus: Focus | null;
}> {
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const [rounds, practice, focus] = await Promise.all([
    rows<TeamRound>(`team_rounds?select=*&played_on=gte.${since}&order=played_on.desc&limit=1000`),
    rows<TeamPracticeRow>(
      `team_practice?select=user_id,set_id,played_on,title,kind,made,attempts,session&played_on=gte.${since}&limit=2000`,
    ),
    rows<Focus>(`team_focus?select=team_id,session,set_at&team_id=eq.${teamId}`),
  ]);
  return { rounds, practice, focus: focus[0] ?? null };
}

/** The week's practice for every team you are on. Practice shows the starred team's. */
export async function loadFocus(): Promise<(Focus & { team: string })[]> {
  if (!currentSession() || !online()) return [];
  const [focus, teams, members] = await Promise.all([
    rows<Focus>('team_focus?select=team_id,session,set_at'),
    rows<Pick<Team, 'id' | 'name'>>('teams?select=id,name'),
    rows<Pick<Member, 'team_id' | 'user_id' | 'starred'>>('team_members?select=team_id,user_id,starred'),
  ]);
  const me = currentSession()!.userId;
  const starred = members.find((m) => m.user_id === me && m.starred)?.team_id;
  return focus
    .map((f) => ({ ...f, team: teams.find((t) => t.id === f.team_id)?.name ?? 'Your team' }))
    .sort((a, b) => Number(b.team_id === starred) - Number(a.team_id === starred) || b.set_at.localeCompare(a.set_at));
}

export async function setFocus(teamId: string, session: string): Promise<void> {
  const res = await table('team_focus?on_conflict=team_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      team_id: teamId,
      session,
      set_by: currentSession()!.userId,
      set_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error('Only the owner or a coach can set the week.');
}

export async function setRole(teamId: string, member: string, role: 'member' | 'coach'): Promise<void> {
  const res = await table('rpc/set_member_role', {
    method: 'POST',
    body: JSON.stringify({ t: teamId, member, new_role: role }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'That did not work.');
  }
}

/**
 * An invite you opened but have not used yet. Kept so the join still happens if you sign in some
 * other way first, or close the app halfway through making an account.
 */
const PENDING_JOIN = 'break.join';

export function pendingJoin(): string | null {
  try {
    return localStorage.getItem(PENDING_JOIN);
  } catch {
    return null;
  }
}

export function rememberJoin(code: string | null) {
  try {
    if (code) localStorage.setItem(PENDING_JOIN, code.toUpperCase());
    else localStorage.removeItem(PENDING_JOIN);
  } catch {
    // Private mode: the link itself still works, it just is not remembered.
  }
}

/** Everyone you share a team with, by id. A player on two of your teams appears twice; either name will do. */
function namesOf(members: Pick<Member, 'user_id' | 'display_name'>[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of members) if (m.display_name && !out.has(m.user_id)) out.set(m.user_id, m.display_name);
  return out;
}

/** One post opened from the feed: what it is made of, who posted it, and who tapped Nice. */
export async function loadTeamRound(user: string, roundId: string) {
  const [round, who, reactions] = await Promise.all([
    rows<TeamRound>(`team_rounds?select=*&user_id=eq.${user}&round_id=eq.${encodeURIComponent(roundId)}`),
    rows<Pick<Member, 'user_id' | 'display_name'>>('team_members?select=user_id,display_name'),
    rows<Reaction>(`team_reactions?select=post,user_id&post=eq.${encodeURIComponent(`round:${user}:${roundId}`)}`),
  ]);
  return { round: round[0] ?? null, names: namesOf(who), reactions };
}

export async function loadTeamDay(user: string, date: string) {
  const [sets, who, reactions] = await Promise.all([
    rows<TeamPracticeRow>(
      `team_practice?select=user_id,set_id,played_on,title,kind,made,attempts,session&user_id=eq.${user}&played_on=eq.${date}&order=updated_at.asc`,
    ),
    rows<Pick<Member, 'user_id' | 'display_name'>>('team_members?select=user_id,display_name'),
    rows<Reaction>(`team_reactions?select=post,user_id&post=eq.${encodeURIComponent(`practice:${user}:${date}`)}`),
  ]);
  return { sets, names: namesOf(who), reactions };
}

/** Everything the leaderboard ranks on, back to the start of last season so every window has data. */
export async function loadBoard(): Promise<{ rounds: TeamRound[]; practice: TeamPracticeRow[] }> {
  if (!currentSession() || !online()) return { rounds: [], practice: [] };
  const [rounds, practice] = await Promise.all([
    rows<TeamRound>('team_rounds?select=*&order=played_on.desc&limit=3000'),
    rows<TeamPracticeRow>('team_practice?select=user_id,set_id,played_on,title,kind,made,attempts&limit=5000'),
  ]);
  return { rounds, practice };
}

/** One teammate's live round, read fresh each time the live page polls. */
export async function loadLive(user: string) {
  const [stat, who] = await Promise.all([
    rows<Pick<PlayerStats, 'user_id' | 'live'>>(`team_stats?select=user_id,live&user_id=eq.${user}`),
    rows<Pick<Member, 'user_id' | 'display_name'>>(
      `team_members?select=user_id,display_name&user_id=eq.${user}&limit=1`,
    ),
  ]);
  return { live: stat[0]?.live ?? null, name: who[0]?.display_name ?? null };
}
