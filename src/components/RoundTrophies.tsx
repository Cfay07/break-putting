import { useMemo, useState } from 'react';
import { fmtDate, signed } from '../lib/format';
import { go } from '../lib/router';
import { headlineRanks, rankedRounds, rankText, roundRanks, swingHoles, type RankLine } from '../lib/roundRanks';
import { courseLabel, type Stats } from '../lib/stats';
import { holeVsPar, type Round } from '../lib/types';
import { Sheet } from './Sheet';
import { fmtIndex, indexAt } from '../lib/handicap';
import { useCourseRatings } from '../lib/useCourseRatings';

const parText = (v: number) => (v === 0 ? 'E' : v > 0 ? `+${v}` : String(v));
const badge = (l: RankLine) => (l.since ? '↑' : `${l.tied ? 'T' : '#'}${l.rank}`);

/**
 * The round in one card: score, putts and gained, where it ranks among your rounds (found for
 * you, three at most, only real records), then the hole that made it and the one that cost it.
 * A ranking opens as your own leaderboard for that number.
 */
export function RoundStory({
  round,
  rounds,
  stats,
  baseline,
}: {
  round: Round;
  rounds: Round[];
  stats: Stats;
  baseline: [number, number][];
}) {
  const swing = swingHoles(round, baseline);
  const scored = round.holes.filter((h) => holeVsPar(h) !== undefined);
  const toPar = scored.reduce((a, h) => a + holeVsPar(h)!, 0);
  const heads = useMemo(() => headlineRanks(roundRanks(round, rounds, baseline)), [round, rounds, baseline]);
  const [open, setOpen] = useState<string | null>(null);
  const list = open ? rankedRounds(round, rounds, baseline, open) : null;
  const courses = useCourseRatings();
  const index = useMemo(() => indexAt(round, rounds, courses), [round, rounds, courses]);

  return (
    <section className="story">
      <div className="story-nums">
        {round.score !== undefined && (
          <div>
            <span>Score</span>
            <strong className="num">
              {round.score}
              {scored.length > 0 && <small> ({parText(toPar)})</small>}
            </strong>
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
        {index !== null && (
          <div>
            <span>Handicap</span>
            <strong className="num">{fmtIndex(index)}</strong>
          </div>
        )}
      </div>

      {heads.map((l, i) => (
        <button key={l.key} className="story-rank" onClick={() => setOpen(l.key)}>
          <em className={i === 0 && !l.since ? 'gold' : undefined}>{badge(l)}</em>
          <span>
            <b>{`${l.label}, ${l.value}`}</b>
            <small>{rankText(l)}</small>
          </span>
        </button>
      ))}

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
