import type { PlayerStats, TeamRound } from './teams';

/** A practice set as a teammate sees it. */
export interface TeamPracticeRow {
  user_id: string;
  set_id: string;
  played_on: string;
  title: string;
  kind: 'test' | 'set';
  made: number;
  attempts: number;
  /** The session it was rolled in, so the coach can see who did the week's practice. */
  session?: string | null;
}

export interface Reaction {
  post: string;
  user_id: string;
}

export type Post =
  | {
      kind: 'round';
      key: string;
      user: string;
      date: string;
      headline: string;
      big: { putts: number | null; three: number | null; sg: number | null };
      highlight: string | null;
      /** Rare enough to stand out: a long one holed, or a pile of one-putts. */
      hot: boolean;
      roundId: string;
    }
  | {
      kind: 'practice';
      key: string;
      user: string;
      date: string;
      headline: string;
      test: { made: number; attempts: number } | null;
      sets: { title: string; made: number; attempts: number }[];
    };

export interface Live {
  user: string;
  hole: number;
  thru: number;
  course?: string;
}

/** Live means logged in the last three hours. A round abandoned on the 9th green is not live. */
const LIVE_HOURS = 3;

export function liveNow(stats: PlayerStats[], members: string[], now = Date.now()): Live[] {
  return stats
    .filter((s) => members.includes(s.user_id) && s.live)
    .filter((s) => now - Date.parse(s.live!.started_at) < LIVE_HOURS * 3600_000)
    .map((s) => ({ user: s.user_id, hole: s.live!.hole, thru: s.live!.thru, course: s.live!.course }));
}

/** The one line worth saying about a round, from the hole detail a teammate can see. */
function highlightOf(r: TeamRound): string | null {
  const holed = (r.detail ?? []).filter((h) => h.p === 1 && h.d !== null && h.d >= 15).sort((a, b) => b.d! - a.d!)[0];
  if (holed) return `Holed a ${holed.d}-footer on ${holed.h}.`;
  if (r.three_putts === 0 && (r.holes_played ?? 0) >= 9) return 'No three-putts.';
  const ones = (r.detail ?? []).filter((h) => h.p === 1).length;
  if (ones >= 6) return `${ones} one-putts.`;
  return null;
}

function isHot(r: TeamRound): boolean {
  const ones = (r.detail ?? []).filter((h) => h.p === 1);
  return ones.some((h) => (h.d ?? 0) >= 25) || ones.length >= 8;
}

/**
 * Every post is made from what was logged: nobody writes one. A round is one post. A day of
 * practice is one post per player, so twelve drills do not bury everything else.
 */
export function buildFeed(rounds: TeamRound[], practice: TeamPracticeRow[], names: Map<string, string>): Post[] {
  const name = (u: string) => names.get(u) ?? 'A teammate';
  const posts: Post[] = rounds
    .filter((r) => r.played_on)
    .map((r) => ({
      kind: 'round' as const,
      key: `round:${r.user_id}:${r.round_id}`,
      user: r.user_id,
      date: r.played_on!,
      headline:
        r.score !== null && (r.holes_played ?? 0) >= 9
          ? `${name(r.user_id)} shot ${r.score}${r.course ? ` at ${r.course}` : ''}`
          : `${name(r.user_id)} logged ${r.holes_played ?? ''} holes${r.course ? ` at ${r.course}` : ''}`.replace(
              '  ',
              ' ',
            ),
      big: { putts: r.putts, three: r.three_putts, sg: r.sg },
      highlight: highlightOf(r),
      hot: isHot(r),
      roundId: r.round_id,
    }));

  const days = new Map<string, TeamPracticeRow[]>();
  for (const p of practice) {
    const k = `${p.user_id}|${p.played_on}`;
    days.set(k, [...(days.get(k) ?? []), p]);
  }
  for (const [k, sets] of days) {
    const [user, date] = k.split('|');
    const test = sets.find((s) => s.kind === 'test');
    const drills = sets.filter((s) => s.kind === 'set');
    posts.push({
      kind: 'practice',
      key: `practice:${user}:${date}`,
      user,
      date,
      headline: test
        ? `${name(user)} took the weekly test`
        : `${name(user)} practiced ${drills.length} ${drills.length === 1 ? 'drill' : 'drills'}`,
      test: test ? { made: test.made, attempts: test.attempts } : null,
      sets: drills.map((s) => ({ title: s.title, made: s.made, attempts: s.attempts })),
    });
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || (a.kind === 'round' ? -1 : 1));
}

export function reactionsFor(post: string, reactions: Reaction[], me: string) {
  const on = reactions.filter((r) => r.post === post);
  return { count: on.length, mine: on.some((r) => r.user_id === me) };
}
