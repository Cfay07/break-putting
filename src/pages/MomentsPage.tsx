import { useMemo, useState } from 'react';
import { MomentCard } from '../components/MomentCard';
import { fmtDate } from '../lib/format';
import { fitMakeModel } from '../lib/makeability';
import { allMoments, type Moment } from '../lib/moments';
import { shareMoment } from '../lib/momentShare';
import { go } from '../lib/router';
import { useApp } from '../lib/store';
import type { Round } from '../lib/types';
import { makeChanceOf } from '../lib/xp';

const SORTS = { recent: 'Recent', rarest: 'Rarest' } as const;

/** Every moment from every round. The solo version of the feed. */
export function MomentsPage() {
  const { state } = useApp();
  const [sort, setSort] = useState<keyof typeof SORTS>('recent');
  const [note, setNote] = useState('');
  const all = useMemo(() => {
    const model = fitMakeModel(state.rounds);
    return allMoments(state.rounds, state.baseline, (p) => makeChanceOf(model, p));
  }, [state.rounds, state.baseline]);
  const list = sort === 'recent' ? all : [...all].sort((a, b) => b.m.rarity - a.m.rarity);
  const share = (m: Moment, round: Round) =>
    void shareMoment(m, round, state.baseline).catch((e) => setNote((e as Error).message));

  return (
    <>
      <div style={{ marginBottom: 6 }}>
        <button className="linkish tiny" onClick={() => go('/')}>
          ← Rounds
        </button>
      </div>
      <div className="list-head">
        <h2>Your moments</h2>
        <div className="sort-pick">
          {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>
              {SORTS[k]}
            </button>
          ))}
        </div>
      </div>
      <p className="small muted" style={{ margin: '4px 0 0' }}>
        {all.length
          ? `${all.length} from ${new Set(all.map((x) => x.round.id)).size} rounds. Each round keeps its three rarest, measured against the rounds before it.`
          : 'Log a few rounds and the putts worth remembering show up here.'}
      </p>
      {note && <p className="small neg">{note}</p>}
      <div className="moments-reel">
        {list.map(({ round, m }, i) => (
          <div key={`${round.id}-${m.kind}`}>
            {(sort === 'rarest' || list[i - 1]?.round.id !== round.id) && (
              <button className="moment-when" onClick={() => go(`/round/${round.id}`)}>
                {fmtDate(round.date)}
                {round.course ? ` · ${round.course}` : ''} ›
              </button>
            )}
            <MomentCard m={m} dark={m.rarity >= 0.95 && !m.low} onShare={() => share(m, round)} />
          </div>
        ))}
      </div>
    </>
  );
}
