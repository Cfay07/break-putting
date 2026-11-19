import { useMemo, useState } from 'react';
import { fmtDate, signed } from '../lib/format';
import { go } from '../lib/router';
import { headlineRanks, rankedRounds, rankText, roundRanks, swingHoles, type RankLine } from '../lib/roundRanks';
import { courseLabel, type Stats } from '../lib/stats';
import { holeVsPar, type Round } from '../lib/types';
import { Sheet } from './Sheet';

const parText = (v: number) => (v === 0 ? 'E' : v > 0 ? `+${v}` : String(v));
const badge = (l: RankLine) => (l.since ? '↑' : `${l.tied ? 'T' : '#'}${l.rank}`);

/** The round in one card: the three numbers that matter, then the hole that made it and the one that cost it. */
export function RoundStory({ round, stats, baseline }: { round: Round; stats: Stats; baseline: [number, number][] }) {
  const swing = swingHoles(round, baseline);
  const scored = round.holes.filter((h) => holeVsPar(h) !== undefined);
  const toPar = scored.reduce((a, h) => a + holeVsPar(h)!, 0);
  return (
    <section className="story">
      <div className="story-nums">
        {round.score !== undefined && (
          <div>
            <span>Score</span>
            <strong className="num">{round.score}</strong>
            {scored.length > 0 && <small>{parText(toPar)}</small>}
          </div>
        )}
        <div>
          <span>Putts</span>
          <strong className="num">{stats.totalPutts}</strong>
        </div>
        <div>
          <span>Gained</span>
          <strong className={stats.sg >= 0 ? 'num up' : 'num down'}>{signed(stats.sg)}</strong>
        </div>
      </div>
      {swing && (
        <div className="story-swing">
          <div>
            <span>Best hole</span>
            <b>
              {swing.best.hole} · {swing.best.first} ft{swing.best.putts === 1 ? ', holed' : ''}
            </b>
            <em className="up">{signed(swing.best.sg)}</em>
          </div>
          <div>
            <span>Cost the most</span>
            <b>
              {swing.worst.hole} ·{' '}
              {swing.worst.putts >= 3 ? `3-putt from ${swing.worst.first} ft` : `missed ${swing.worst.first} ft`}
            </b>
            <em className="down">{signed(swing.worst.sg)}</em>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * This round in your history: where it ranks against every round you have logged, found for you.
 * Each ranking opens as your own leaderboard for it, and the trophy room holds the all-time best
 * and worst.
 */
export function RoundTrophies({
  round,
  rounds,
  baseline,
}: {
  round: Round;
  rounds: Round[];
  baseline: [number, number][];
}) {
  const lines = useMemo(() => roundRanks(round, rounds, baseline), [round, rounds, baseline]);
  const heads = headlineRanks(lines);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const list = open ? rankedRounds(round, rounds, baseline, open) : null;

  if (!lines.length) return null;
  return (
    <section className="trophies">
      <div className="section-head">
        <h2>History</h2>
        <a href="#/history">All your history ›</a>
      </div>
      {heads.length ? (
        <div className="board">
          {heads.map((l) => (
            <button key={l.key} className="lb-row trophy-row" onClick={() => setOpen(l.key)}>
              <span className={l.rank === 1 && !l.since ? 'trophy-badge gold' : 'trophy-badge'}>{badge(l)}</span>
              <span className="nm">
                {l.label}
                <small>
                  {l.value} · {rankText(l)}
                </small>
              </span>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          No records this round. Every ranking is still one tap away.
        </p>
      )}
      <button className="linkish tiny" style={{ marginTop: 8 }} onClick={() => setAll(true)}>
        Every ranking for this round ({lines.length})
      </button>

      {all && (
        <Sheet title="Every ranking" onClose={() => setAll(false)}>
          <div className="board">
            {lines.map((l) => (
              <button
                key={l.key}
                className="lb-row trophy-row"
                onClick={() => {
                  setAll(false);
                  setOpen(l.key);
                }}
              >
                <span
                  className={l.rank === 1 ? 'trophy-badge gold' : 'trophy-badge'}
                >{`${l.tied ? 'T' : '#'}${l.rank}`}</span>
                <span className="nm">
                  {l.label}
                  <small>
                    {l.value} · of {l.of} {l.pool}
                  </small>
                </span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {list && (
        <Sheet title={list.label} onClose={() => setOpen(null)}>
          <p className="small muted" style={{ margin: '0 0 8px' }}>
            Every round you have logged, best first. This round is marked.
          </p>
          <RankedList rows={list.rows} current={round.id} onPick={(id) => (setOpen(null), go(`/round/${id}`))} />
        </Sheet>
      )}
    </section>
  );
}

export function RankedList({
  rows,
  current,
  onPick,
}: {
  rows: { round: Round; value: string; place: number }[];
  current?: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="board">
      {rows.map((r) => (
        <button
          key={r.round.id}
          className={r.round.id === current ? 'lb-row me lead' : 'lb-row'}
          onClick={() => onPick(r.round.id)}
        >
          <span className="place num">
            {rows.filter((x) => x.place === r.place).length > 1 ? `T${r.place}` : r.place}
          </span>
          <span className="nm">
            {fmtDate(r.round.date)}
            <small>{courseLabel(r.round)}</small>
          </span>
          <span className="val num">{r.value}</span>
        </button>
      ))}
    </div>
  );
}
