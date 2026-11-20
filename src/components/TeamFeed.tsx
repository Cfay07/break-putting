import { useEffect, useMemo, useState } from 'react';
import { buildFeed, liveNow, reactionsFor, type Post, type Reaction } from '../lib/feed';
import { fmtDate, signed } from '../lib/format';
import { lastLoaded, remember } from '../lib/lastLoaded';
import { loadFeed, setReaction, type PlayerStats, type TeamRound } from '../lib/teams';
import { go } from '../lib/router';
import type { TeamPracticeRow } from '../lib/feed';

const SHOWN = 25;

const parText = (v: number) => (v === 0 ? 'E' : v > 0 ? `+${v}` : String(v));

/**
 * The team, as it happens: who is on the course right now, then every round and practice day,
 * newest first, each with one tap to say nice. Nobody writes a post; the app makes them.
 */
export function TeamFeed({
  members,
  stats,
  me,
}: {
  members: { id: string; name: string }[];
  stats: PlayerStats[];
  me: string;
}) {
  const [data, setData] = useState<{ rounds: TeamRound[]; practice: TeamPracticeRow[]; reactions: Reaction[] } | null>(
    () => lastLoaded('feed') ?? null,
  );
  const [err, setErr] = useState('');
  useEffect(() => {
    loadFeed()
      .then((d) => setData(remember('feed', d)))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the feed.'));
  }, []);

  const ids = useMemo(() => members.map((m) => m.id), [members]);
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.id === me ? 'You' : m.name])), [members, me]);
  const live = liveNow(
    stats,
    ids.filter((id) => id !== me),
  );
  const posts = useMemo(
    () =>
      data
        ? buildFeed(
            data.rounds.filter((r) => ids.includes(r.user_id)),
            data.practice.filter((p) => ids.includes(p.user_id)),
            names,
          ).slice(0, SHOWN)
        : [],
    [data, ids, names],
  );

  const toggle = async (post: string) => {
    if (!data) return;
    const { mine } = reactionsFor(post, data.reactions, me);
    const next = mine
      ? data.reactions.filter((r) => !(r.post === post && r.user_id === me))
      : [...data.reactions, { post, user_id: me }];
    setData({ ...data, reactions: next });
    try {
      await setReaction(post, !mine);
    } catch (e) {
      setData(data);
      setErr(e instanceof Error ? e.message : 'Could not save that.');
    }
  };

  return (
    <section className="feed">
      {live.map((l) => (
        <button key={l.user} className="feed-live" onClick={() => go(`/team/live/${l.user}`)}>
          <span className="feed-live-dot">Live</span>
          <span className="feed-live-main">
            <strong>
              {names.get(l.user)} · hole {l.hole}
            </strong>
            <span>
              {l.thru} {l.thru === 1 ? 'hole' : 'holes'} logged
              {l.putts !== undefined ? ` · ${l.putts} putts` : ''}
              {l.toPar !== undefined && l.toPar !== null ? `, ${parText(l.toPar)}` : ''}
              {l.course ? ` · ${l.course}` : ''}
            </span>
            {l.proj && (
              <span className="feed-live-proj">
                On pace for {l.proj.putts} putts
                {l.proj.score !== null && l.proj.toPar !== null
                  ? `, ${l.proj.score} (${parText(l.proj.toPar)})`
                  : l.proj.toPar !== null
                    ? `, ${parText(l.proj.toPar)}`
                    : ''}
              </span>
            )}
          </span>
        </button>
      ))}

      {err && <p className="small neg">{err}</p>}
      {!data && !err && <p className="small muted">Loading the feed…</p>}
      {data && !posts.length && (
        <p className="small muted">
          Nothing yet. Every round and practice day your team logs shows up here on its own.
        </p>
      )}

      {posts.map((p) => (
        <FeedCard
          key={p.key}
          post={p}
          me={me}
          react={reactionsFor(p.key, data!.reactions, me)}
          onReact={() => void toggle(p.key)}
        />
      ))}
    </section>
  );
}

function FeedCard({
  post,
  me,
  react,
  onReact,
}: {
  post: Post;
  me: string;
  react: { count: number; mine: boolean };
  onReact: () => void;
}) {
  const own = post.user === me;
  // Your own round opens the full round you logged; anyone else's opens what they shared.
  const href =
    post.kind === 'round'
      ? own
        ? `/round/${post.roundId}`
        : `/team/round/${post.user}/${encodeURIComponent(post.roundId)}`
      : `/team/practice/${post.user}/${post.date}`;
  const open = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('.feed-react')) return;
    go(href);
  };
  return (
    <article
      className={post.kind === 'round' && post.hot ? 'feed-card hot tappable' : 'feed-card tappable'}
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open(e)}
    >
      <header className="feed-head">
        <strong>{post.headline}</strong>
        <span>{fmtDate(post.date)}</span>
      </header>

      {post.kind === 'round' ? (
        <>
          {post.highlight && <p className="feed-highlight">{post.highlight}</p>}
          <div className="feed-nums">
            {post.big.putts !== null && (
              <span>
                <b className="num">{post.big.putts}</b>putts
              </span>
            )}
            {post.big.three !== null && (
              <span>
                <b className="num">{post.big.three}</b>three-putts
              </span>
            )}
            {post.big.sg !== null && (
              <span>
                <b className={post.big.sg >= 0 ? 'num pos' : 'num'}>{signed(post.big.sg)}</b>strokes gained
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          {post.test && (
            <p className="feed-test">
              <b className="num">{post.test.made}</b> of {post.test.attempts} on the test
            </p>
          )}
          {post.sets.length > 0 && (
            <p className="feed-sets">
              {post.sets
                .slice(0, 4)
                .map((s) => (s.attempts ? `${s.title} ${s.made}/${s.attempts}` : s.title))
                .join(' · ')}
              {post.sets.length > 4 ? ` · ${post.sets.length - 4} more` : ''}
            </p>
          )}
        </>
      )}

      <footer className="feed-foot">
        <button
          className={react.mine ? 'feed-react on' : 'feed-react'}
          aria-pressed={react.mine}
          onClick={(e) => {
            e.stopPropagation();
            onReact();
          }}
        >
          Nice{react.count ? ` · ${react.count}` : ''}
        </button>
        <span className="feed-open" aria-hidden="true">
          {post.kind === 'round' ? 'Round' : 'Practice'} ›
        </span>
      </footer>
    </article>
  );
}
