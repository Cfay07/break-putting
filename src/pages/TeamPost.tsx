import { useEffect, useState } from 'react';
import { currentSession } from '../lib/cloud';
import { buildFeed, reactionsFor, type Reaction, type TeamPracticeRow } from '../lib/feed';
import { fmtDateLong, signed } from '../lib/format';
import { backLabel, go, previousRoute } from '../lib/router';
import { expectedPutts } from '../lib/sg';
import { loadTeamDay, loadTeamRound, setReaction, type TeamRound } from '../lib/teams';
import { DEFAULT_BASELINE } from '../lib/types';

const me = () => currentSession()?.userId ?? '';

function Back() {
  const from = previousRoute();
  const to = from && !from.startsWith('/team/') ? from : '/team';
  return (
    <div style={{ marginBottom: 6 }}>
      <button className="linkish tiny" onClick={() => go(to)}>
        ← {to === '/team' ? 'Team' : backLabel(to)}
      </button>
    </div>
  );
}

/** Nice, with who said it. Optimistic: the tap shows at once and comes back off if it fails. */
function NiceBar({ post, initial, names }: { post: string; initial: Reaction[]; names: Map<string, string> }) {
  const [reactions, setReactions] = useState(initial);
  const [err, setErr] = useState('');
  const { count, mine } = reactionsFor(post, reactions, me());
  const who = reactions.map((r) => (r.user_id === me() ? 'You' : (names.get(r.user_id) ?? 'A teammate')));

  const toggle = async () => {
    const before = reactions;
    setReactions(mine ? reactions.filter((r) => r.user_id !== me()) : [...reactions, { post, user_id: me() }]);
    try {
      await setReaction(post, !mine);
    } catch (e) {
      setReactions(before);
      setErr(e instanceof Error ? e.message : 'Could not save that.');
    }
  };

  return (
    <div className="post-nice">
      <button className={mine ? 'feed-react on' : 'feed-react'} aria-pressed={mine} onClick={() => void toggle()}>
        Nice{count ? ` · ${count}` : ''}
      </button>
      {who.length > 0 && <span className="small muted">{who.join(', ')}</span>}
      {err && <span className="small neg">{err}</span>}
    </div>
  );
}

const vsPar = (v: number | null) => (v === null ? '' : v === 0 ? 'E' : v > 0 ? `+${v}` : String(v));

/** A teammate's round, opened from the feed. Built only from what they share with the team. */
export function TeamRoundPage({ user, roundId }: { user: string; roundId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadTeamRound>> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    loadTeamRound(user, roundId)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the round.'));
  }, [user, roundId]);

  if (err) return <ErrorState text={err} />;
  if (!data) return <p className="small muted">Loading the round…</p>;
  if (!data.round || !data.round.played_on)
    return <ErrorState text="That round is gone. Its player deleted it or left the team." />;

  const r: TeamRound = data.round;
  const names = new Map(data.names);
  if (user === me()) names.set(user, 'You');
  const post = buildFeed([r], [], names)[0];
  const holes = (r.detail ?? []).filter((h) => h.p > 0 || h.v !== null);
  const putting = holes.filter((h) => h.p > 0);
  const ones = putting.filter((h) => h.p === 1);
  const longest = ones.reduce((a, h) => Math.max(a, h.d ?? 0), 0);
  const played = r.holes_played ?? putting.length;
  const scored = holes.filter((h) => h.v !== null);
  const toPar = scored.reduce((a, h) => a + h.v!, 0);
  const tiles: { k: string; v: string; cls?: string; sub?: string }[] = [
    { k: 'Putts', v: r.putts !== null ? String(r.putts) : '--' },
    { k: '1-putts', v: String(ones.length) },
    { k: '3-putts', v: r.three_putts !== null ? String(r.three_putts) : '--', cls: r.three_putts ? 'neg' : undefined },
    { k: 'Gained', v: r.sg !== null ? signed(r.sg) : '--', cls: r.sg === null ? undefined : r.sg >= 0 ? 'pos' : 'neg' },
    { k: 'Per hole', v: r.putts !== null && played ? (r.putts / played).toFixed(1) : '--' },
    { k: '2-putts', v: String(putting.filter((h) => h.p === 2).length) },
    {
      k: 'Score',
      v: r.score !== null ? String(r.score) : '--',
      sub: scored.length ? `${vsPar(toPar)} on ${scored.length}` : undefined,
    },
    { k: 'Longest', v: longest ? String(longest) : '--', sub: longest ? 'feet holed' : undefined },
  ];

  return (
    <>
      <Back />
      <div className="round-head">
        <h3 style={{ fontSize: 21 }}>{fmtDateLong(r.played_on!)}</h3>
      </div>
      <h2 className="post-title">{post.headline}</h2>
      {post.kind === 'round' && post.highlight && <p className="feed-highlight">{post.highlight}</p>}

      <div className="round-numbers">
        {tiles.map((t) => (
          <div key={t.k}>
            <span>{t.k}</span>
            <strong className={t.cls ? `num ${t.cls}` : 'num'}>{t.v}</strong>
            <small>{t.sub ?? ''}</small>
          </div>
        ))}
      </div>

      <NiceBar post={post.key} initial={data.reactions} names={names} />

      <h2>Scorecard</h2>
      {holes.length ? (
        <div className="sc-wrap">
          {holes.map((h) => {
            const sg = h.p > 0 && h.d ? expectedPutts(DEFAULT_BASELINE, h.d) - h.p : null;
            return (
              <div key={h.h} className={h.p >= 3 ? 'sc-row three' : 'sc-row'}>
                <span className="h">{h.h}</span>
                <span className="seq">
                  {h.p === 0 ? 'no putts logged' : h.d ? `${h.d} ft${h.p === 1 ? ', holed' : ''}` : '--'}
                </span>
                <span className={h.v !== null && h.v < 0 ? 'rel num pos' : 'rel num'}>{vsPar(h.v)}</span>
                <span className="n num">{h.p || ''}</span>
                <span
                  className={
                    sg === null ? 'sg' : sg <= -0.5 ? 'sg down big' : sg < 0 ? 'sg down' : sg > 0 ? 'sg up' : 'sg'
                  }
                >
                  {sg === null ? '' : sg > 0 ? `+${sg.toFixed(2)}` : sg.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="small muted">This round was shared before hole detail was. It shows on their next round.</p>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>
        First putt length, score against par, putts, and strokes gained on each hole against tour averages.
      </p>
    </>
  );
}

/** A teammate's practice day, opened from the feed: every set, in the order they were rolled. */
export function TeamPracticePage({ user, date }: { user: string; date: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadTeamDay>> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    loadTeamDay(user, date)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the practice.'));
  }, [user, date]);

  if (err) return <ErrorState text={err} />;
  if (!data) return <p className="small muted">Loading the practice…</p>;
  if (!data.sets.length) return <ErrorState text="Nothing left from that day. The sets were deleted." />;

  const names = new Map(data.names);
  if (user === me()) names.set(user, 'You');
  const post = buildFeed([], data.sets, names)[0];
  const putts = data.sets.reduce((a, s) => a + s.attempts, 0);
  const made = data.sets.reduce((a, s) => a + s.made, 0);
  const test = data.sets.find((s) => s.kind === 'test');

  return (
    <>
      <Back />
      <div className="round-head">
        <h3 style={{ fontSize: 21 }}>{fmtDateLong(date)}</h3>
      </div>
      <h2 className="post-title">{post.headline}</h2>

      <div className="round-numbers">
        <div>
          <span>Sets</span>
          <strong className="num">{data.sets.length}</strong>
          <small />
        </div>
        <div>
          <span>Putts</span>
          <strong className="num">{putts}</strong>
          <small />
        </div>
        <div>
          <span>Counted</span>
          <strong className="num">{putts ? `${Math.round((made / putts) * 100)}%` : '--'}</strong>
          <small>{putts ? `${made} of ${putts}` : ''}</small>
        </div>
        <div>
          <span>Test</span>
          <strong className="num">{test ? `${test.made}/${test.attempts}` : '--'}</strong>
          <small>{test ? 'weekly test' : ''}</small>
        </div>
      </div>

      <NiceBar post={post.key} initial={data.reactions} names={names} />

      <h2>Sets</h2>
      <div className="board">
        {data.sets.map((s: TeamPracticeRow) => (
          <div key={s.set_id} className="lb-row">
            <span className="nm">
              {s.title}
              {s.kind === 'test' && !/weekly test/i.test(s.title) && (
                <span className="small muted"> · weekly test</span>
              )}
            </span>
            <span className="val num">{s.attempts ? `${s.made}/${s.attempts}` : '--'}</span>
            <span className="val num muted">{s.attempts ? `${Math.round((s.made / s.attempts) * 100)}%` : ''}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Counted means what each drill scores: holed, inside a circle, or past the hole, depending on the drill.
      </p>
    </>
  );
}

function ErrorState({ text }: { text: string }) {
  return (
    <>
      <Back />
      <p className="small muted">{text}</p>
    </>
  );
}
